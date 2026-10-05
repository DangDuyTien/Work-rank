import { expect, test } from '@playwright/test';

const user = { id: 8, name: 'Member 8', email: 'member8@example.test', role: 'admin', status: 'active', teamId: 8 };
const season = { id: 41, name: 'Season 41', status: 'ACTIVE', startAt: '2026-01-01', endAt: '2027-01-01' };
const grand = { id: 51, name: 'Grand 51', year: 2026, status: 'ACTIVE', startAt: '2026-01-01', endAt: '2027-01-01' };
const members = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1, name: `Member ${index + 1}`, email: `member${index + 1}@example.test`,
  role: 'member', status: 'active', presence: 'online', teamId: index + 1,
}));
const teamRows = members.map((member, index) => ({
  teamId: member.teamId, teamName: `Team ${member.teamId}`, rank: index + 1, score: 800 - index * 50,
  grandPoints: 80 - index * 5, isEligible: true, membersCount: 1, seasonWins: 1, podiumCount: 2, completedSeasons: 3,
}));
const individualRows = members.map((member, index) => ({
  ...member, userId: member.id, userName: member.name, teamName: `Team ${member.teamId}`, rank: index + 1,
  score: 800 - index * 50, points: 800 - index * 50, grandPoints: 80 - index * 5, seasonsCount: 3, seasonWins: 1,
}));

function youtubeTeamDetails(teamId) {
  return {
    team: { id: teamId, name: `Team ${teamId}` },
    summary: { totalViews: 1000, totalSubscribers: 100, views30d: 200, viewsGrowth30dPct: 25 },
    history: [{ date: '2026-10-01', views: 800, subscribers: 80 }, { date: '2026-10-02', views: 900, subscribers: 95 }, { date: '2026-10-03', views: 1000, subscribers: 100 }],
    channels: [{ id: teamId, channelId: `channel-${teamId}`, title: `Channel Team ${teamId}`, views: 1000, subscribers: 100 }],
  };
}

async function mockWorkspace(page, options = {}) {
  const requests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const currentCode = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const periods = options.periods || [
    { id: 61, code: currentCode, name: 'Current KPI period' },
    { id: 62, code: '2020-01', name: 'Archived KPI period' },
  ];
  await page.addInitScript(() => localStorage.setItem('token', 'information-architecture-test-token'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    let json = { data: [] };
    if (url.pathname === '/api/auth/me') json = { user: { ...user, ...options.user } };
    if (url.pathname === '/api/friends/requests') json = { incoming: [], outgoing: [] };
    if (url.pathname === '/api/chats/unread-counts') json = { data: {} };
    if (url.pathname === '/api/users') json = { data: members, pagination: { total: 8, totalPages: 1, page: 1 } };
    if (url.pathname === '/api/groups/all') json = { data: teamRows.map((team) => ({ id: team.teamId, name: team.teamName, memberCount: 1, members: [] })) };
    if (url.pathname === '/api/dashboard/realtime-users') json = { users: members };
    if (url.pathname === '/api/dashboard/overview') json = { online: 8 };
    if (url.pathname === '/api/kpi/my-kpis') json = { data: { department: null, period: null, kpis: [] } };
    if (url.pathname === '/api/kpi/departments') json = { data: [{ id: 1, code: 'CONTENT', name: 'Content' }] };
    if (url.pathname === '/api/kpi/periods') json = { data: periods };
    if (url.pathname === '/api/kpi/results') {
      const isArchived = url.searchParams.get('periodId') === '62';
      json = { data: [{
        id: isArchived ? 2 : 1, departmentId: 1, progressPct: isArchived ? 35 : 85,
        user: { id: 8, name: isArchived ? 'Archived KPI Member' : 'Current KPI Member' },
      }] };
    }
    if (url.pathname === '/api/competition/dashboard') json = {
      userSummary: { currentSeasonScore: 450, currentSeasonRank: 8 },
      teamSummary: { teamId: 8, teamName: 'Team 8', currentSeasonScore: 450, currentSeasonRank: 8, membersCount: 1 },
    };
    if (url.pathname === '/api/competition/admin/rules') json = { ruleSets: [] };
    if (url.pathname === '/api/competition/admin/integration/health') json = { outbox: { failedCount: 0 }, events: { totalProcessed: 0 } };
    if (url.pathname === '/api/competition/admin/integration/events') json = { events: [], total: 0 };
    if (url.pathname === '/api/competition/admin/projections/status') json = { seasonTeamsCount: 0, seasonIndividualsCount: 0, scoreLedgerCount: 0 };
    if (url.pathname === '/api/competition/admin/audit-logs') json = { logs: [] };
    if (url.pathname === '/api/youtube/admin/health') json = { status: 'HEALTHY' };
    if (url.pathname.endsWith('/recognitions')) json = { badges: [] };
    if (url.pathname === '/api/youtube/overview') json = {
      history: [{ date: '2026-10-01', views: 800, subscribers: 80 }, { date: '2026-10-02', views: 900, subscribers: 95 }, { date: '2026-10-03', views: 1000, subscribers: 100 }],
      kpis: { totalViews: 1000, totalSubscribers: 100, totalChannels: 8, totalTeams: 8, viewsGrowthPct: 10, unassignedChannelsCount: 1, unassignedViews: 20 },
      topTeamsByViews: teamRows.map((team) => ({ ...team, totalViews: team.score, totalSubscribers: team.grandPoints })),
      topTeamsByGrowth: teamRows.map((team) => ({ ...team, totalViews: team.score, viewsGrowth30dPct: team.grandPoints })),
    };
    if (url.pathname === '/api/youtube/my-overview') json = { channels: [], teamSummary: null };
    const youtubeTeamMatch = url.pathname.match(/^\/api\/youtube\/teams\/(\d+)$/);
    if (youtubeTeamMatch) {
      const teamId = Number(youtubeTeamMatch[1]);
      json = options.youtubeTeamDetails ? await options.youtubeTeamDetails(teamId) : youtubeTeamDetails(teamId);
    }
    if (url.pathname === '/api/youtube/compare') {
      const teamA = Number(url.searchParams.get('teamA'));
      const teamB = Number(url.searchParams.get('teamB'));
      json = options.youtubeComparison ? await options.youtubeComparison(teamA, teamB) : {
        teamA: { id: teamA, name: `Team ${teamA}`, totalViews: 1000, totalSubscribers: 100, viewsGrowth30dPct: 25, channelsCount: 1 },
        teamB: { id: teamB, name: `Team ${teamB}`, totalViews: 500, totalSubscribers: 50, viewsGrowth30dPct: 10, channelsCount: 1 },
      };
    }
    if (url.pathname === '/api/rankings/seasons') json = { seasons: [season, { ...season, id: 42, name: 'Season 42' }] };
    if (url.pathname === '/api/rankings/grands') json = { grands: [grand, { ...grand, id: 52, name: 'Grand 52', year: 2025 }] };
    if (url.pathname === '/api/rankings/teams') json = { items: teamRows, total: teamRows.length };
    if (url.pathname === '/api/rankings/individuals') json = { items: individualRows, total: individualRows.length };
    if (url.pathname === '/api/rankings/individuals' && options.paginateIndividuals) {
      const pageNumber = Number(url.searchParams.get('page') || 1);
      json = { items: pageNumber === 1 ? individualRows : [{
        id: 101, userId: 101, userName: 'Member 101', rank: 101, teamName: 'Team 101', score: 10,
      }], total: 201, page: pageNumber, totalPages: 3 };
    }
    if (url.pathname === '/api/rankings/youtube' || url.pathname === '/api/youtube/leaderboard') json = { items: [], total: 0 };
    if (url.pathname === '/api/competition/seasons/active') json = { season };
    if (url.pathname === '/api/competition/seasons/41') json = { season, myTeam: { teamId: 8, teamNameSnapshot: 'Team 8' } };
    if (url.pathname === '/api/competition/seasons/41/leaderboard') json = { rankings: teamRows };
    if (url.pathname === '/api/competition/seasons/41/individual-leaderboard') json = { rankings: individualRows };
    if (url.pathname === '/api/competition/seasons/41/challenges') json = { challenges: [] };
    if (url.pathname === '/api/competition/seasons/41/rules') json = { hasRules: false, rules: [] };
    if (url.pathname === '/api/competition/grand/current') json = { grand };
    if (url.pathname === '/api/competition/grand/51/standings') json = { standings: teamRows };
    if (url.pathname === '/api/competition/grand/51/individual-standings') json = { standings: individualRows };
    if (url.pathname === '/api/competition/grand/51/timeline') json = { timeline: [] };
    if (url.pathname === '/api/competition/grand/51/teams/8/journey') json = { history: [] };
    await route.fulfill({ json });
  });
  return { requests, errors };
}

function matchingRequests(requests, pathname, params = {}) {
  return requests.filter((url) => url.pathname === pathname
    && Object.entries(params).every(([key, value]) => url.searchParams.get(key) === String(value)));
}

async function expectRankingLocation(page, params) {
  await expect(page).toHaveURL((url) => url.pathname === '/leaderboard'
    && Object.entries(params).every(([key, value]) => url.searchParams.get(key) === String(value)));
}

async function capturePage(page, testInfo, name, errors) {
  await expect(page.getByRole('heading', { name: 'Không tải được giao diện', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const screenshot = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
}

async function captureChartViewport(page, testInfo, chart, name) {
  await chart.evaluate((element) => element.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    .map((animation) => animation.finished.catch(() => {}))));
  await expect(chart).toBeInViewport();
  const screenshot = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
}

for (const scenario of [
  { name: 'season members', url: '/rankings?scope=season&ranking=individual&seasonId=41#positions', params: { scope: 'members', period: 'season', seasonId: 41 }, path: '/api/rankings/individuals', apiParams: { scope: 'season', seasonId: 41 } },
  { name: 'grand teams', url: '/rankings?scope=grand&ranking=team&grandId=51#positions', params: { scope: 'teams', period: 'grand', grandId: 51 }, path: '/api/rankings/teams', apiParams: { scope: 'grand', grandId: 51 } },
  { name: 'member mode', url: '/rankings?mode=member&period=all-time#positions', params: { scope: 'members', period: 'all-time' }, path: '/api/rankings/individuals', apiParams: { scope: 'all-time' } },
]) {
  test(`legacy rankings redirect preserves ${scenario.name} context`, async ({ page }) => {
    const { requests, errors } = await mockWorkspace(page);
    await page.goto(scenario.url);
    await expectRankingLocation(page, scenario.params);
    expect(new URL(page.url()).hash).toBe('#positions');
    expect(new URL(page.url()).searchParams.has('ranking')).toBe(false);
    expect(new URL(page.url()).searchParams.has('mode')).toBe(false);
    await expect.poll(() => matchingRequests(requests, scenario.path, scenario.apiParams).length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

for (const scenario of [
  { name: 'channels', url: '/youtube?tab=channel_leaderboard&sortBy=subscribers&teamId=8', params: { scope: 'youtube', view: 'channels', metric: 'subscribers', channelTeam: 8 }, apiParams: { view: 'channels', sortBy: 'subscribers', teamId: 8 } },
  { name: 'teams', url: '/youtube?tab=team_leaderboard&metric=growth', params: { scope: 'youtube', view: 'teams', metric: 'growth' }, apiParams: { view: 'teams', sortBy: 'growth' } },
]) {
  test(`legacy YouTube ${scenario.name} tab opens the canonical ranking`, async ({ page }) => {
    const { requests, errors } = await mockWorkspace(page);
    await page.goto(scenario.url);
    await expectRankingLocation(page, scenario.params);
    await expect.poll(() => matchingRequests(requests, '/api/rankings/youtube', scenario.apiParams).length).toBeGreaterThan(0);
    expect(matchingRequests(requests, '/api/youtube/overview')).toHaveLength(0);
    expect(errors).toEqual([]);
  });
}

test('legacy YouTube admin tab opens team and channel administration', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/youtube?tab=admin');
  await expect(page).toHaveURL(/\/admin\/teams-youtube(?:\?|$)/);
});

for (const path of ['/admin/teams-youtube', '/admin/competition/rules']) {
  test(`member is redirected from ${path} before admin API requests`, async ({ page }) => {
    const { requests } = await mockWorkspace(page, { user: { role: 'member' } });
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page.locator('#dashboard-community .ranking-flip-row')).toHaveCount(6);
    expect(requests.filter((url) => /\/admin(?:\/|$)/.test(url.pathname))).toHaveLength(0);
  });
}

test('competition rules defaults to Rule Sets without loading operations', async ({ page }) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/admin/competition/rules');
  await expect(page.getByRole('heading', { name: 'Danh Sách Bộ Quy Tắc (Rule Sets)', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có Rule Set nào', exact: true })).toBeVisible();
  expect(matchingRequests(requests, '/api/competition/admin/rules').length).toBeGreaterThan(0);
  expect(matchingRequests(requests, '/api/competition/admin/dashboard')).toHaveLength(0);
  expect(matchingRequests(requests, '/api/competition/admin/integration/health')).toHaveLength(0);
  expect(matchingRequests(requests, '/api/competition/admin/projections/status')).toHaveLength(0);
  await expect(page.getByRole('button', { name: /Bắn Sự Kiện/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const scenario of [
  { legacyTab: 'integration', canonicalTab: 'events' },
  { legacyTab: 'projections', canonicalTab: 'projections' },
]) {
  test(`legacy competition ${scenario.legacyTab} tab opens canonical operations`, async ({ page }) => {
    const { requests, errors } = await mockWorkspace(page);
    await page.goto(`/admin/competition/rules?tab=${scenario.legacyTab}`);
    await expect(page).toHaveURL((url) => url.pathname === '/admin/operations' && url.searchParams.get('tab') === scenario.canonicalTab);
    await expect(page.getByRole('heading', { name: 'Giám Sát Vận Hành & Nhật Ký Kiểm Toán', exact: true })).toBeVisible();
    if (scenario.canonicalTab === 'events') {
      await expect(page.getByPlaceholder('Tìm theo loại sự kiện (contractKey), ID hoặc Actor...')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Tính Toán Lại Bảng Xếp Hạng (Read Model Rebuild)', exact: true })).toBeVisible();
    }
    expect(matchingRequests(requests, '/api/competition/admin/integration/events').length).toBeGreaterThan(0);
    expect(matchingRequests(requests, '/api/competition/admin/projections/status').length).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /Bắn Sự Kiện/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const scenario of [
  { name: 'season', scope: 'teams', idKey: 'seasonId', initialId: 41, selectedId: 42, label: 'Chọn mùa giải', apiPath: '/api/rankings/teams' },
  { name: 'grand', scope: 'members', idKey: 'grandId', initialId: 51, selectedId: 52, label: 'Chọn giải vô địch năm', apiPath: '/api/rankings/individuals' },
]) {
  test(`ranking ${scenario.name} selector updates the API context`, async ({ page }) => {
    const { requests } = await mockWorkspace(page);
    await page.goto(`/leaderboard?scope=${scenario.scope}&period=${scenario.name}&${scenario.idKey}=${scenario.initialId}`);
    await expect.poll(() => matchingRequests(requests, scenario.apiPath, { scope: scenario.name, [scenario.idKey]: scenario.initialId }).length).toBeGreaterThan(0);
    await expect(page.getByLabel(scenario.label)).toHaveValue(String(scenario.initialId));
    await page.getByLabel(scenario.label).selectOption(String(scenario.selectedId));
    await expectRankingLocation(page, { scope: scenario.scope, period: scenario.name, [scenario.idKey]: scenario.selectedId });
    await expect.poll(() => matchingRequests(requests, scenario.apiPath, { scope: scenario.name, [scenario.idKey]: scenario.selectedId }).length).toBeGreaterThan(0);
  });
}

test('KPI ranking defaults to the current month and keeps explicit period selection', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/leaderboard');
  await expect(page.getByText('Current KPI Member', { exact: true })).toBeVisible();
  expect(matchingRequests(requests, '/api/kpi/results').map((url) => url.searchParams.get('periodId'))).toEqual(['61']);
  await capturePage(page, testInfo, 'leaderboard-kpi', errors);
  await page.getByLabel('Chọn kỳ KPI').selectOption('62');
  await expectRankingLocation(page, { scope: 'kpi', periodId: 62 });
  await expect(page.getByText('Archived KPI Member', { exact: true })).toBeVisible();
  await expect(page.getByText('Current KPI Member', { exact: true })).toHaveCount(0);
  await expect.poll(() => matchingRequests(requests, '/api/kpi/results', { periodId: 62 }).length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByLabel('Chọn kỳ KPI')).toHaveValue('62');
  await expect(page.getByText('Archived KPI Member', { exact: true })).toBeVisible();
});

test('KPI ranking with no current month does not request results from every period', async ({ page }) => {
  const { requests } = await mockWorkspace(page, { periods: [{ id: 62, code: '2020-01', name: 'Archived KPI period' }] });
  await page.goto('/leaderboard?scope=kpi');
  await expect(page.getByText('Chưa có dữ liệu KPI', { exact: true })).toBeVisible();
  expect(matchingRequests(requests, '/api/kpi/results')).toHaveLength(0);
});

test('ranking pagination requests page 2 and preserves real ranks without a podium', async ({ page }) => {
  const { requests } = await mockWorkspace(page, { paginateIndividuals: true });
  await page.goto('/leaderboard?scope=members&period=season&seasonId=41');
  await expect(page.getByText('Trang 1 / 3', { exact: true })).toBeVisible();
  await expect(page.locator('.leaderboard-podium')).toHaveCount(1);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expectRankingLocation(page, { scope: 'members', period: 'season', seasonId: 41, page: 2 });
  await expect.poll(() => matchingRequests(requests, '/api/rankings/individuals', { scope: 'season', seasonId: 41, page: 2, limit: 100 }).length).toBeGreaterThan(0);
  await expect(page.getByText('Trang 2 / 3', { exact: true })).toBeVisible();
  await expect(page.locator('.leaderboard-podium')).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: 'Member 101' });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('cell').first().getByText('101', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await expect(page.getByText('Trang 1 / 3', { exact: true })).toBeVisible();
  await expect(page.locator('.leaderboard-podium')).toHaveCount(1);
});

for (const scenario of [
  { view: 'members', expectedPath: '/api/rankings/individuals', unusedPath: '/api/rankings/youtube' },
  { view: 'youtube', expectedPath: '/api/rankings/youtube', unusedPath: '/api/rankings/individuals' },
]) {
  test(`team drilldown loads only the active ${scenario.view} view`, async ({ page }) => {
    const { requests } = await mockWorkspace(page);
    await page.goto(`/leaderboard?scope=teams&period=season&seasonId=41&teamId=8&teamView=${scenario.view}`);
    await expect.poll(() => matchingRequests(requests, scenario.expectedPath, { teamId: 8 }).length).toBeGreaterThan(0);
    expect(matchingRequests(requests, scenario.unusedPath)).toHaveLength(0);
  });
}

test('YouTube overview keeps analytics previews and links to canonical ranking', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/youtube');
  const chart = page.getByRole('img', { name: /Lịch sử YouTube toàn công ty/ });
  await expect(chart).toBeVisible();
  await expect(chart.locator('path[fill="none"]')).toHaveAttribute('d', /M.+L/);
  await expect(page.getByRole('heading', { name: 'YouTube', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top 5 đội theo lượt xem', exact: true })).toBeVisible();
  await expect(page.locator('.youtube-overview-panels').getByRole('link', { name: /#\d/ })).toHaveCount(10);
  await expect(page.getByRole('link', { name: 'BXH YouTube', exact: true })).toHaveAttribute('href', '/leaderboard?scope=youtube&view=channels&metric=views');
  expect(matchingRequests(requests, '/api/groups/all').length).toBeGreaterThan(0);
  expect(matchingRequests(requests, '/api/rankings/youtube')).toHaveLength(0);
  expect(matchingRequests(requests, '/api/youtube/leaderboard')).toHaveLength(0);
  await capturePage(page, testInfo, 'youtube-overview', errors);
  await captureChartViewport(page, testInfo, chart, 'youtube-overview-chart-viewport');
});

test('YouTube member own-team deep link shows its analytics and chart', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page, { user: { role: 'member' } });
  await page.goto('/youtube?tab=team_detail&teamId=8');
  await expect(page.getByRole('heading', { name: 'YouTube · Team 8', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toBeVisible();
  const chart = page.getByRole('img', { name: /Lịch sử YouTube của Team 8/ });
  await expect(chart.locator('path[fill="none"]')).toHaveAttribute('d', /M.+L/);
  expect(matchingRequests(requests, '/api/youtube/teams/8')).toHaveLength(1);
  expect(matchingRequests(requests, '/api/groups/all')).toHaveLength(0);
  await captureChartViewport(page, testInfo, chart, 'youtube-own-team-chart-viewport');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get('teamId') === '8');
  expect(errors).toEqual([]);
});

test('YouTube member other-team deep link keeps its ID and denies private analytics', async ({ page }) => {
  const { requests, errors } = await mockWorkspace(page, { user: { role: 'member' } });
  await page.goto('/youtube?tab=team_detail&teamId=7');
  await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem chi tiết YouTube của đội này.');
  await expect(page.getByRole('heading', { name: 'YouTube · Đội #7', exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get('teamId') === '7');
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toHaveCount(0);
  expect(requests.filter((url) => /^\/api\/youtube\/teams\//.test(url.pathname))).toHaveLength(0);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem chi tiết YouTube của đội này.');
  expect(requests.filter((url) => /^\/api\/youtube\/teams\//.test(url.pathname))).toHaveLength(0);
  await page.getByRole('tab', { name: 'Kênh đội bạn', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('teamId') === '8');
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toBeVisible();
  expect(matchingRequests(requests, '/api/youtube/teams/7')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('YouTube team deep link lets an admin select another company team', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/youtube?tab=team_detail&teamId=7');
  await expect(page.getByRole('heading', { name: 'Channel Team 7', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Đội', exact: true })).toHaveValue('7');
  await page.getByRole('combobox', { name: 'Đội', exact: true }).selectOption('6');
  await expect(page).toHaveURL((url) => url.searchParams.get('teamId') === '6');
  await expect(page.getByRole('heading', { name: 'Channel Team 6', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Channel Team 7', exact: true })).toHaveCount(0);
  const chart = page.getByRole('img', { name: /Lịch sử YouTube của Team 6/ });
  await captureChartViewport(page, testInfo, chart, 'youtube-admin-team-chart-viewport');
  expect(matchingRequests(requests, '/api/youtube/teams/7')).toHaveLength(1);
  expect(matchingRequests(requests, '/api/youtube/teams/6')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('YouTube refresh response cannot replace a newly selected team', async ({ page }) => {
  let releaseRefresh;
  let teamEightRequests = 0;
  const delayedRefresh = new Promise((resolve) => { releaseRefresh = resolve; });
  const { requests, errors } = await mockWorkspace(page, {
    youtubeTeamDetails: async (teamId) => {
      if (teamId === 8 && ++teamEightRequests === 2) await delayedRefresh;
      return youtubeTeamDetails(teamId);
    },
  });
  await page.goto('/youtube?tab=team_detail&teamId=8');
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect.poll(() => matchingRequests(requests, '/api/youtube/teams/8').length).toBe(2);
  await page.getByRole('combobox', { name: 'Đội', exact: true }).selectOption('7');
  await expect(page.getByRole('heading', { name: 'Channel Team 7', exact: true })).toBeVisible();
  releaseRefresh();
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled();
  await expect(page).toHaveURL((url) => url.searchParams.get('teamId') === '7');
  await expect(page.getByRole('heading', { name: 'Channel Team 7', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Channel Team 8', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('YouTube compare refresh cannot replace a newly selected pair of teams', async ({ page }) => {
  let releaseRefresh;
  let initialPairRequests = 0;
  const delayedRefresh = new Promise((resolve) => { releaseRefresh = resolve; });
  const { requests, errors } = await mockWorkspace(page, {
    youtubeComparison: async (teamA, teamB) => {
      if (teamA === 1 && teamB === 2 && ++initialPairRequests === 2) await delayedRefresh;
      return {
        teamA: { id: teamA, name: `Team ${teamA}`, totalViews: 1000, totalSubscribers: 100, viewsGrowth30dPct: 25, channelsCount: 1 },
        teamB: { id: teamB, name: `Team ${teamB}`, totalViews: 500, totalSubscribers: 50, viewsGrowth30dPct: 10, channelsCount: 1 },
      };
    },
  });
  await page.goto('/youtube?tab=compare');
  await expect(page.getByRole('columnheader', { name: 'Team 1', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Team 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect.poll(() => matchingRequests(requests, '/api/youtube/compare', { teamA: 1, teamB: 2 }).length).toBe(2);
  await page.getByRole('combobox', { name: 'Đội A', exact: true }).selectOption('3');
  await expect(page.getByRole('columnheader', { name: 'Team 3', exact: true })).toBeVisible();
  releaseRefresh();
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled();
  await expect(page.getByRole('columnheader', { name: 'Team 3', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Team 2', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Team 1', exact: true })).toHaveCount(0);
  expect(matchingRequests(requests, '/api/youtube/compare', { teamA: 3, teamB: 2 })).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('team administration loads the full company team list', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/admin/teams-youtube');
  await expect(page.getByRole('heading', { name: 'Quản Lý & Phân Tầng Dữ Liệu YouTube', exact: true })).toBeVisible();
  await expect.poll(() => matchingRequests(requests, '/api/groups/all').length).toBeGreaterThan(0);
  expect(matchingRequests(requests, '/api/groups')).toHaveLength(0);
  await capturePage(page, testInfo, 'admin-teams-youtube', errors);
});

test('Dashboard uses presence and summary APIs without loading full rankings', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Xin chào, Member 8' })).toBeVisible();
  await expect(page.locator('#dashboard-community .ranking-flip-row')).toHaveCount(6);
  expect(matchingRequests(requests, '/api/dashboard/realtime-users').length).toBeGreaterThan(0);
  expect(matchingRequests(requests, '/api/competition/dashboard').length).toBeGreaterThan(0);
  expect(requests.filter((url) => /^\/api\/(?:leaderboard|rankings)\//.test(url.pathname)
    || url.pathname === '/api/youtube/leaderboard')).toHaveLength(0);
  await capturePage(page, testInfo, 'dashboard-summary', errors);
});

test('Friends opens the directory without loading a second leaderboard', async ({ page }, testInfo) => {
  const { requests, errors } = await mockWorkspace(page);
  await page.goto('/friends');
  await expect(page.getByRole('heading', { name: 'Thành Viên & Đội Nhóm', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Tìm theo tên, email, chức danh, mã WR-0001...')).toBeVisible();
  await expect.poll(() => matchingRequests(requests, '/api/users').length).toBeGreaterThan(0);
  expect(requests.filter((url) => /^\/api\/(?:leaderboard|rankings)\//.test(url.pathname)
    || url.pathname === '/api/youtube/leaderboard')).toHaveLength(0);
  await capturePage(page, testInfo, 'friends-directory', errors);
});

for (const scenario of [
  { pagePath: '/arena', period: 'season', idKey: 'seasonId', id: 41 },
  { pagePath: '/grand', period: 'grand', idKey: 'grandId', id: 51 },
]) {
  test(`${scenario.pagePath} previews Top 5 and the user's position with contextual ranking links`, async ({ page }, testInfo) => {
    const { requests, errors } = await mockWorkspace(page);
    await page.goto(scenario.pagePath);
    const rows = page.locator('.ranking-flip-row');
    await expect(rows).toHaveCount(6);
    await expect(rows.filter({ hasText: 'Team 8' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Team 6' })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Team 7' })).toHaveCount(0);
    const fullRankingLink = page.getByRole('link', { name: /^Xem toàn bộ BXH/ });
    await expect(fullRankingLink).toHaveAttribute('href', `/leaderboard?scope=teams&period=${scenario.period}&${scenario.idKey}=${scenario.id}`);
    await capturePage(page, testInfo, `${scenario.period}-team-preview`, errors);
    await page.getByRole('button', { name: /^BXH Cá Nhân/ }).click();
    await expect(rows).toHaveCount(6);
    await expect(rows.filter({ hasText: 'Member 8' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Member 6' })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Member 7' })).toHaveCount(0);
    await expect(fullRankingLink).toHaveAttribute('href', `/leaderboard?scope=members&period=${scenario.period}&${scenario.idKey}=${scenario.id}`);
    expect(matchingRequests(requests, '/api/youtube/leaderboard')).toHaveLength(0);
    await capturePage(page, testInfo, `${scenario.period}-member-preview`, errors);
  });
}
