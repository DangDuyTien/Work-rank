import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { privateMediaApi } from '../services/privateMediaApi';

/**
 * PRIVATE MEDIA — entitlement hook
 *
 * This hook decides ONE thing: whether the UI may render the capability at all.
 * It is a presentation concern only. The backend re-authorizes every request,
 * so a tampered client that forces `entitled: true` still gets 404 on every
 * endpoint.
 *
 * A single probe is shared per user for the whole tab session: the sidebar and
 * the route guard must not each fire their own request.
 */

const EMPTY = {
  loading: true,
  entitled: false,
  isOwner: false,
  permissions: {
    view: false, control: false, telegram: false, hotkey: false, manageAccess: false,
  },
};

let cache = { userId: null, value: null, promise: null };

function snapshotFrom(data) {
  if (!data || data.entitled !== true) {
    return {
      loading: false,
      entitled: false,
      isOwner: false,
      permissions: { view: false, control: false, telegram: false, hotkey: false, manageAccess: false },
    };
  }
  return {
    loading: false,
    entitled: true,
    isOwner: Boolean(data.isOwner),
    permissions: {
      view: Boolean(data.permissions?.view),
      control: Boolean(data.permissions?.control),
      telegram: Boolean(data.permissions?.telegram),
      hotkey: Boolean(data.permissions?.hotkey),
      manageAccess: Boolean(data.permissions?.manageAccess),
    },
  };
}

function load(userId) {
  if (!userId) return Promise.resolve(snapshotFrom(null));
  if (cache.userId === String(userId) && cache.value) return Promise.resolve(cache.value);
  if (cache.userId === String(userId) && cache.promise) return cache.promise;

  cache = { userId: String(userId), value: null, promise: null };
  const promise = privateMediaApi.getAccess()
    .then((data) => snapshotFrom(data))
    .catch(() => snapshotFrom(null))
    .then((value) => {
      cache = { userId: String(userId), value, promise: null };
      return value;
    });

  cache.promise = promise;
  return promise;
}

/** Synchronous snapshot for non-React consumers (page titles, guards). */
export function getPrivateMediaSnapshot() {
  return cache.value || EMPTY;
}

export function invalidatePrivateMediaAccess() {
  cache = { userId: null, value: null, promise: null };
}

export function usePrivateMediaAccess() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [state, setState] = useState(() => {
    const cached = getPrivateMediaSnapshot();
    return cache.userId === String(userId) && cache.value ? cached : { ...EMPTY };
  });

  useEffect(() => {
    let active = true;
    if (!userId) {
      setState(snapshotFrom(null));
      return () => { active = false; };
    }

    const cached = cache.userId === String(userId) ? cache.value : null;
    if (cached) {
      setState(cached);
      return () => { active = false; };
    }

    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    load(userId).then((value) => {
      if (active) setState(value);
    });

    return () => { active = false; };
  }, [userId]);

  return state;
}

export default usePrivateMediaAccess;
