import { useEffect, useState } from 'react';
import { competition } from '../services/api';

// Public data only. Keep request lifecycle separate from auth form mode changes.
export default function usePublicSpotlight() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    Promise.all([competition.getPublicSpotlight(), competition.getPublicWeeklyLeaderboard()]).then(([result, weeklyResult]) => {
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('Invalid public spotlight response');
      }
      if (current) setData(result);
      if (current) setWeekly(Array.isArray(weeklyResult?.items) ? weeklyResult.items : []);
    }).catch(() => {
      if (current) setError(true);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [attempt]);

  const archives = Array.isArray(data?.archives) ? data.archives : [];
  return { data, archives, weekly, loading, error, retry: () => setAttempt((value) => value + 1) };
}
