import { useState, useEffect, useRef, useCallback } from 'react';
import { cache, isDeepEqual, CACHE_TTL } from '../services/cache';

/**
 * Custom React hook for Stale-While-Revalidate data fetching
 * 
 * Provides:
 * - Instant rendering of cached data (0ms, no flash/skeleton on return visits)
 * - Transparent background revalidation (isRevalidating: true)
 * - Deep equality check to eliminate duplicate rerenders when data hasn't changed
 * - Multi-component request coalescing
 * - Direct cache mutation & cross-component sync
 * 
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function returning fresh data
 * @param {Object} options - { ttl, enabled, initialData, onSuccess, onError }
 */
export function useCachedData(key, fetcher, options = {}) {
  const {
    ttl = CACHE_TTL.MEDIUM,
    enabled = true,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const cachedEntry = key ? cache.getEntry(key) : null;
  const hasCachedData = cachedEntry !== null && cachedEntry.data !== undefined;

  const [data, setData] = useState(() => (hasCachedData ? cachedEntry.data : initialData));
  const [loading, setLoading] = useState(!hasCachedData && enabled && Boolean(key));
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const dataRef = useRef(data);
  dataRef.current = data;
  const previousKeyRef = useRef(key);

  const revalidate = useCallback(async (isManual = false) => {
    if (!key || !fetcherRef.current) return;

    const currentCached = cache.getEntry(key);
    const hasData = currentCached !== null && currentCached.data !== undefined;

    if (!hasData && !isManual) {
      setLoading(true);
    } else {
      setIsRevalidating(true);
    }
    setError(null);

    try {
      const freshData = await cache.fetchWithCache(key, fetcherRef.current, {
        ttl,
        force: isManual,
      });

      if (!isDeepEqual(dataRef.current, freshData)) {
        setData(freshData);
      }
      if (onSuccess) onSuccess(freshData);
      return freshData;
    } catch (err) {
      setError(err);
      if (onError) onError(err);
      // Keep existing data in state on error (graceful degradation)
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [key, ttl, onSuccess, onError]);

  // Subscribe to external cache updates (e.g. from socket events or mutations)
  useEffect(() => {
    if (!key) return;

    const unsubscribe = cache.subscribe(key, (nextData) => {
      if (!isDeepEqual(dataRef.current, nextData)) {
        setData(nextData);
      }
    });

    return unsubscribe;
  }, [key]);

  // A scope change (for example switching account or team) must never keep
  // rendering the previous resource while the new request is in flight.
  useEffect(() => {
    if (previousKeyRef.current === key) return;
    previousKeyRef.current = key;
    const nextEntry = key ? cache.getEntry(key) : null;
    const nextData = nextEntry?.data !== undefined ? nextEntry.data : initialData;
    dataRef.current = nextData;
    setData(nextData);
    setError(null);
    setIsRevalidating(false);
    setLoading(Boolean(enabled && key && !nextEntry));
  }, [key, enabled, initialData]);

  // Handle key change / mount
  useEffect(() => {
    if (!enabled || !key) return;

    const currentCached = cache.getEntry(key);
    if (currentCached && currentCached.data !== undefined) {
      if (!isDeepEqual(dataRef.current, currentCached.data)) {
        setData(currentCached.data);
      }
      setLoading(false);

      // Background revalidate if stale
      if (cache.isStale(key, ttl)) {
        revalidate(false);
      }
    } else {
      revalidate(false);
    }
  }, [key, enabled, ttl, revalidate]);

  const mutate = useCallback((next) => {
    return cache.mutate(key, next);
  }, [key]);

  return {
    data,
    loading,
    isRevalidating,
    error,
    refetch: () => revalidate(true),
    mutate,
  };
}
