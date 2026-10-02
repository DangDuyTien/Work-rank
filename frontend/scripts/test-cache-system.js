#!/usr/bin/env node

/**
 * TEST SUITE: WORKRANK IN-MEMORY CACHE & REQUEST COALESCING ENGINE
 */

import assert from 'assert';
import {
  cache,
  createCacheKey,
  isDeepEqual,
  CACHE_TTL,
  fetchWithCache,
  getCached,
  setCached,
  invalidateCache,
  clearCache,
} from '../src/services/cache.js';

async function runCacheTests() {
  console.log('🧪 [Cache System Test Suite] Running in-memory cache & deduplication tests...\n');
  let passed = 0;

  // Test 1: createCacheKey deterministic ordering
  {
    const k1 = createCacheKey('rankings', { search: 'alpha', period: 'today', limit: 50 });
    const k2 = createCacheKey('rankings', { limit: 50, period: 'today', search: 'alpha' });
    assert.strictEqual(k1, k2, 'Cache keys with different param order must produce identical key');
    assert.strictEqual(k1, 'rankings?limit=50&period=today&search=alpha');
    console.log('  ✔ 1. Deterministic cache key generation with parameter normalization passed');
    passed++;
  }

  // Test 2: isDeepEqual comparison
  {
    const obj1 = { a: 1, b: [1, 2, { c: 'test' }], d: { e: true } };
    const obj2 = { d: { e: true }, a: 1, b: [1, 2, { c: 'test' }] };
    const obj3 = { a: 1, b: [1, 2, { c: 'test2' }], d: { e: true } };
    assert.strictEqual(isDeepEqual(obj1, obj2), true, 'Identical deep objects must evaluate to true');
    assert.strictEqual(isDeepEqual(obj1, obj3), false, 'Different deep objects must evaluate to false');
    assert.strictEqual(isDeepEqual([1, 2, 3], [1, 2, 3]), true);
    assert.strictEqual(isDeepEqual([1, 2, 3], [1, 2, 4]), false);
    console.log('  ✔ 2. Deep equality comparison for arrays, objects and primitives passed');
    passed++;
  }

  // Test 3: Set and Get
  {
    clearCache();
    setCached('dashboard:totals:today', { keystrokes: 100, clicks: 50 });
    const res = getCached('dashboard:totals:today');
    assert.deepStrictEqual(res, { keystrokes: 100, clicks: 50 });
    console.log('  ✔ 3. Synchronous in-memory set and get passed');
    passed++;
  }

  // Test 4: In-flight Request Deduplication / Coalescing
  {
    clearCache();
    let networkCallCount = 0;
    const mockFetcher = async () => {
      networkCallCount++;
      await new Promise((r) => setTimeout(r, 40));
      return { total: 42, timestamp: Date.now() };
    };

    // Fire 5 identical requests simultaneously
    const results = await Promise.all([
      fetchWithCache('competition:dashboard', mockFetcher),
      fetchWithCache('competition:dashboard', mockFetcher),
      fetchWithCache('competition:dashboard', mockFetcher),
      fetchWithCache('competition:dashboard', mockFetcher),
      fetchWithCache('competition:dashboard', mockFetcher),
    ]);

    assert.strictEqual(networkCallCount, 1, `Expected exactly 1 network call, got ${networkCallCount}`);
    assert.strictEqual(results.length, 5);
    assert.strictEqual(results[0].total, 42);
    assert.strictEqual(results[0], results[1], 'All concurrent callers must receive the exact same Promise result');
    console.log('  ✔ 4. In-flight request deduplication (5 concurrent calls coalesced into 1) passed');
    passed++;
  }

  // Test 5: Fresh Cache Avoids Network Call
  {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { data: 'fresh' };
    };

    setCached('test:fresh', { data: 'already_cached' }, { ttl: 60000 });
    const res = await fetchWithCache('test:fresh', fetcher, { ttl: 60000 });

    assert.strictEqual(callCount, 0, 'Should not have called fetcher when cache is fresh');
    assert.deepStrictEqual(res, { data: 'already_cached' });
    console.log('  ✔ 5. Fresh cache hit skips network fetcher passed');
    passed++;
  }

  // Test 6: Stale Invalidation
  {
    setCached('user:profile:100', { name: 'Alice' }, { ttl: 60000 });
    setCached('user:profile:200', { name: 'Bob' }, { ttl: 60000 });
    setCached('youtube:overview', { views: 999 }, { ttl: 60000 });

    assert.strictEqual(cache.isStale('user:profile:100'), false);

    // Invalidate user:profile prefix
    invalidateCache('user:profile');

    assert.strictEqual(cache.isStale('user:profile:100'), true);
    assert.strictEqual(cache.isStale('user:profile:200'), true);
    assert.strictEqual(cache.isStale('youtube:overview'), false, 'Unrelated key must remain fresh');
    console.log('  ✔ 6. Prefix-targeted cache invalidation passed');
    passed++;
  }

  // Test 7: Cache Clear on Logout
  {
    setCached('private:user:1', { secret: 'abc' });
    setCached('dashboard:totals:today', { clicks: 10 });
    assert.strictEqual(cache.has('private:user:1'), true);

    clearCache();

    assert.strictEqual(cache.has('private:user:1'), false);
    assert.strictEqual(cache.has('dashboard:totals:today'), false);
    assert.strictEqual(getCached('private:user:1'), null);
    console.log('  ✔ 7. Full cache wipe for user session isolation passed');
    passed++;
  }

  // Test 8: Pub/Sub Listener Notification
  {
    clearCache();
    let notificationReceived = null;
    const unsub = cache.subscribe('arena:season:1', (nextData) => {
      notificationReceived = nextData;
    });

    setCached('arena:season:1', { name: 'Season 1', status: 'ACTIVE' });
    assert.deepStrictEqual(notificationReceived, { name: 'Season 1', status: 'ACTIVE' });

    unsub();
    setCached('arena:season:1', { name: 'Season 1', status: 'FINISHED' });
    // Should not receive after unsubscribe
    assert.deepStrictEqual(notificationReceived, { name: 'Season 1', status: 'ACTIVE' });
    console.log('  ✔ 8. Pub/Sub subscription and subscriber notification passed');
    passed++;
  }

  console.log(`\n🎉 All ${passed}/8 Cache & Request Coalescing tests PASSED with 100% precision!\n`);
}

runCacheTests().catch((err) => {
  console.error('❌ Cache test failed:', err);
  process.exit(1);
});
