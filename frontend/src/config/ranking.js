const SCOPES = {
  kpi: 'kpi',
  team: 'teams',
  teams: 'teams',
  member: 'members',
  members: 'members',
  individual: 'members',
  individuals: 'members',
  youtube: 'youtube',
  hof: 'hall-of-fame',
  'hall-of-fame': 'hall-of-fame',
};
const PERIODS = new Set(['season', 'grand', 'all-time']);

// Preserve bookmarked links from earlier navigation schemes in one place.
export function normalizeRankingParams(search) {
  const params = new URLSearchParams(search);
  const oldScope = params.get('scope');
  const requestedTeamId = params.get('teamId') || params.get('groupId');
  const teamId = /^[1-9]\d*$/.test(requestedTeamId || '') ? requestedTeamId : null;
  const scope = SCOPES[oldScope] || SCOPES[params.get('mode')]
    || SCOPES[params.get('ranking')] || (PERIODS.has(oldScope) || teamId ? 'teams' : 'kpi');
  const requestedPeriod = params.get('period');
  const period = PERIODS.has(requestedPeriod) ? requestedPeriod
    : PERIODS.has(oldScope) ? oldScope : scope === 'members' ? 'all-time' : 'season';

  params.set('scope', scope);
  if (!['teams', 'members', 'youtube'].includes(scope) || !/^[1-9]\d*$/.test(params.get('page') || '') || Number(params.get('page')) === 1) params.delete('page');
  params.delete('mode');
  params.delete('ranking');
  params.delete('groupId');
  if (scope !== 'kpi' || !/^[1-9]\d*$/.test(params.get('periodId') || '')) params.delete('periodId');
  for (const key of ['seasonId', 'grandId']) {
    if (params.has(key) && !/^[1-9]\d*$/.test(params.get(key))) params.delete(key);
  }
  if (teamId && scope !== 'kpi' && scope !== 'hall-of-fame') {
    params.set('teamId', teamId);
    if (scope === 'youtube' && !params.has('teamView')) params.set('teamView', 'youtube');
    if (params.has('teamView') && !['members', 'youtube'].includes(params.get('teamView'))) params.set('teamView', 'members');
  } else {
    params.delete('teamId');
    params.delete('teamView');
  }

  if (scope === 'teams' || scope === 'members' || params.has('teamId')) {
    params.set('period', period);
    if (period !== 'season') params.delete('seasonId');
    if (period !== 'grand') params.delete('grandId');
  } else {
    params.delete('period');
    params.delete('seasonId');
    params.delete('grandId');
  }

  if (scope === 'youtube') {
    params.set('view', params.get('view') === 'teams' ? 'teams' : 'channels');
    const metric = params.get('metric');
    params.set('metric', ['views', 'subscribers', 'growth'].includes(metric) ? metric : 'views');
    if (params.get('view') === 'teams') params.delete('channelTeam');
    else if (params.has('channelTeam') && params.get('channelTeam') !== 'unassigned' && !/^[1-9]\d*$/.test(params.get('channelTeam'))) params.delete('channelTeam');
  } else {
    params.delete('view');
    params.delete('channelTeam');
  }
  return params;
}
