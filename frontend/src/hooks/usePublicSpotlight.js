import { competition } from '../services/api';
import { useCachedData } from './useCachedData';
import { CACHE_TTL } from '../services/cache';

// Public data only. Keep request lifecycle separate from auth form mode changes.
export default function usePublicSpotlight({ includeRankings = false } = {}) {
  const spotlight = useCachedData('public:spotlight', async () => {
    const result = await competition.getPublicSpotlight();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid public spotlight response');
    return result;
  }, { ttl: CACHE_TTL.SHORT });
  const weekly = useCachedData('public:weekly', competition.getPublicWeeklyLeaderboard, {
    ttl: CACHE_TTL.SHORT, enabled: includeRankings,
  });
  const youtube = useCachedData('public:youtube', competition.getPublicYouTubeLeaderboard, {
    ttl: CACHE_TTL.MEDIUM, enabled: includeRankings,
  });
  const members = useCachedData('public:members', competition.getPublicMembers, {
    ttl: CACHE_TTL.MEDIUM, enabled: includeRankings,
  });
  const retry = () => {
    spotlight.refetch();
    if (includeRankings) {
      weekly.refetch();
      youtube.refetch();
      members.refetch();
    }
  };
  return {
    data: spotlight.data,
    archives: Array.isArray(spotlight.data?.archives) ? spotlight.data.archives : [],
    loading: spotlight.loading,
    error: Boolean(spotlight.error),
    weekly: Array.isArray(weekly.data?.items) ? weekly.data.items : [],
    weeklyLoading: weekly.loading,
    weeklyError: Boolean(weekly.error),
    youtube: Array.isArray(youtube.data?.items) ? youtube.data.items.filter((item) => item?.channelId && typeof item.title === 'string').slice(0, 3) : [],
    youtubeLoading: youtube.loading,
    youtubeError: Boolean(youtube.error),
    members: Array.isArray(members.data?.items) ? members.data.items : [],
    membersLoading: members.loading,
    membersError: Boolean(members.error),
    retry,
  };
}
