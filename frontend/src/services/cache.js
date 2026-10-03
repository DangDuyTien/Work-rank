/**
 * WORKRANK CLIENT-SIDE IN-MEMORY CACHE & REQUEST COALESCING ENGINE
 * 
 * Features:
 * - Deterministic cache key generation with namespace and sorted params
 * - In-flight promise deduplication (identical concurrent requests share 1 Promise)
 * - TTL-based freshness (Stale-While-Revalidate pattern)
 * - Deep equality check before triggering state updates (eliminates unnecessary rerenders)
 * - Event-based pub/sub for cache updates (cross-component sync)
 * - Namespace/prefix/pattern invalidation
 * - Complete cache wipe on logout for user/session isolation
 */

export const CACHE_TTL = {
  // Static / Infrequent (5 minutes): Profile, Master data, Seasons/Grands metadata
  STATIC: 5 * 60 * 1000,
  // Medium dynamic (30 seconds): Dashboards, rankings, YouTube overview
  MEDIUM: 30 * 1000,
  // Short dynamic (10 seconds): Fast-changing metrics, competition status
  SHORT: 10 * 1000,
  // Instant: Always revalidate in background if > 0ms
  INSTANT: 0,
};

/**
 * Deep equality helper to compare complex objects/arrays without rerendering
 */
export function isDeepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Deterministic cache key generator
 */
export function createCacheKey(namespace, params = null) {
  if (!params) return String(namespace);
  if (typeof params !== 'object') return `${namespace}:${String(params)}`;

  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => {
      const val = params[k];
      return `${k}=${typeof val === 'object' ? JSON.stringify(val) : String(val)}`;
    })
    .join('&');

  return serialized ? `${namespace}?${serialized}` : String(namespace);
}

class CacheEngine {
  constructor() {
    this.store = new Map(); // key -> { data, timestamp, ttl }
    this.inFlight = new Map(); // key -> Promise
    this.listeners = new Map(); // key -> Set<callback>
  }

  get(key) {
    const entry = this.store.get(key);
    return entry ? entry.data : null;
  }

  getEntry(key) {
    return this.store.get(key) || null;
  }

  has(key) {
    return this.store.has(key);
  }

  isStale(key, customTtl) {
    const entry = this.store.get(key);
    if (!entry) return true;
    const ttl = customTtl !== undefined ? customTtl : entry.ttl;
    return Date.now() - entry.timestamp > ttl;
  }

  set(key, data, options = {}) {
    const { ttl = CACHE_TTL.MEDIUM, silent = false } = options;
    const oldEntry = this.store.get(key);
    const hasChanged = !oldEntry || !isDeepEqual(oldEntry.data, data);

    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    if (hasChanged && !silent) {
      this.notify(key, data);
    }
    return data;
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(key);
      }
    };
  }

  notify(key, data) {
    const subs = this.listeners.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[CacheEngine] subscriber error:', e);
        }
      });
    }
  }

  /**
   * Coalesce in-flight requests and execute with stale-while-revalidate
   */
  async fetchWithCache(key, fetcher, options = {}) {
    const {
      ttl = CACHE_TTL.MEDIUM,
      force = false,
      onRevalidated = null,
    } = options;

    const entry = this.store.get(key);
    const hasCached = Boolean(entry);
    const isStale = this.isStale(key, ttl);

    // If cache is fresh and not forced, return cached data immediately
    if (hasCached && !isStale && !force) {
      return entry.data;
    }

    // Coalesce in-flight requests: share single active Promise
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const requestPromise = (async () => {
      try {
        const freshData = await fetcher();
        this.set(key, freshData, { ttl });
        if (onRevalidated) onRevalidated(freshData);
        return freshData;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Invalidate by exact key or prefix
   */
  invalidate(pattern) {
    if (!pattern) return;

    if (typeof pattern === 'string') {
      for (const [key, entry] of this.store.entries()) {
        if (key === pattern || key.startsWith(`${pattern}:`) || key.startsWith(`${pattern}?`)) {
          entry.timestamp = 0; // Mark stale
        }
      }
    } else if (pattern instanceof RegExp) {
      for (const [key, entry] of this.store.entries()) {
        if (pattern.test(key)) {
          entry.timestamp = 0;
        }
      }
    }
  }

  /**
   * Optimistic mutation
   */
  mutate(key, updaterOrData) {
    const current = this.get(key);
    const nextData = typeof updaterOrData === 'function' ? updaterOrData(current) : updaterOrData;
    this.set(key, nextData, { ttl: CACHE_TTL.MEDIUM });
    return nextData;
  }

  /**
   * Clear entire cache on logout
   */
  clear() {
    this.store.clear();
    this.inFlight.clear();
  }
}

export const cache = new CacheEngine();

// Top-level convenience exports
export const getCached = (key) => cache.get(key);
export const setCached = (key, data, options) => cache.set(key, data, options);
export const fetchWithCache = (key, fetcher, options) => cache.fetchWithCache(key, fetcher, options);
export const invalidateCache = (pattern) => cache.invalidate(pattern);
export const clearCache = () => cache.clear();

// Canonical cache key helpers
export const CACHE_KEYS = {
  DASHBOARD_TOTALS: (range) => `dashboard:totals:${range}`,
  DASHBOARD_USERS: (range) => `dashboard:users:${range}`,
  DASHBOARD_YT_COMPANY: (period) => `dashboard:yt:company:${period}`,
  DASHBOARD_YT_MEMBER: (period) => `dashboard:yt:member:${period}`,
  DASHBOARD_YT_CHANNELS: () => `dashboard:yt:channels`,
  DASHBOARD_KPI_MY_SUMMARY: (userId) => `dashboard:kpi:summary:${userId}`,
  COMPETITION_DASHBOARD: () => `competition:dashboard`,
  RANKINGS: (scope, params = {}) => createCacheKey(`rankings:${scope}`, params),
  RANKINGS_META: () => `rankings:meta`,
  YOUTUBE_OVERVIEW: () => `youtube:overview`,
  YOUTUBE_LEADERBOARD: (view, sortBy) => `youtube:leaderboard:${view}:${sortBy}`,
  ARENA_ACTIVE: () => `arena:active_season`,
  ARENA_SEASON_DETAILS: (seasonId) => `arena:season:${seasonId}`,
  GRAND_CURRENT: () => `grand:current`,
  GRAND_STANDINGS: (grandId) => `grand:${grandId}:standings`,
  USER_PROFILE: (userId) => `user:profile:${userId}`,
  SETTINGS: () => `settings:user`,
};
