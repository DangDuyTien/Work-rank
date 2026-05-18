export const AVATAR_UPDATED_EVENT = 'workrank:profile-avatar-updated';
export const AVATAR_STORAGE_PREFIX = 'workrank:profile-avatar:';

const avatarCache = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(AVATAR_STORAGE_PREFIX)) return;
    const userId = event.key.slice(AVATAR_STORAGE_PREFIX.length);
    avatarCache.set(userId, event.newValue || '');
    window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
      detail: { userId, avatarUrl: event.newValue || '' },
    }));
  });
}

export function avatarStorageKey(userId) {
  return `${AVATAR_STORAGE_PREFIX}${userId}`;
}

export function getStoredAvatar(userId) {
  if (!userId) return '';
  const key = String(userId);
  if (avatarCache.has(key)) return avatarCache.get(key);
  try {
    const value = localStorage.getItem(avatarStorageKey(userId)) || '';
    avatarCache.set(key, value);
    return value;
  } catch {
    return '';
  }
}

export function setStoredAvatar(userId, dataUrl) {
  if (!userId || !dataUrl) return;
  avatarCache.set(String(userId), dataUrl);
  localStorage.setItem(avatarStorageKey(userId), dataUrl);
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
    detail: { userId: String(userId), avatarUrl: dataUrl },
  }));
}

export function removeStoredAvatar(userId) {
  if (!userId) return;
  avatarCache.set(String(userId), '');
  localStorage.removeItem(avatarStorageKey(userId));
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
    detail: { userId: String(userId), avatarUrl: '' },
  }));
}

export function getUserAvatar(user = {}, fallbackUserId = '') {
  const userId = user?.id || user?.user_id || user?.userId || fallbackUserId;
  return getStoredAvatar(userId) || user?.avatarData || user?.avatarUrl || user?.photoUrl || user?.imageUrl || '';
}

export function initialsFromName(name) {
  const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  return String(parts[0] || 'U').slice(0, 2).toUpperCase();
}

export function avatarHue(name, id) {
  const numericId = Number(id);
  const seed = Number.isFinite(numericId)
    ? numericId
    : String(name || 'User').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (seed * 47) % 360;
}
