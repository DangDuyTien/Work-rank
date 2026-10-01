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

  window.addEventListener('workrank:user-updated', (event) => {
    const payload = event.detail;
    const uid = String(payload?.userId || payload?.user?.id || payload?.id || '');
    const newAvatar = payload?.user?.avatarData !== undefined
      ? payload.user.avatarData
      : (payload?.avatarData !== undefined ? payload.avatarData : payload?.userAvatar);

    if (uid) {
      if (newAvatar) {
        setStoredAvatar(uid, newAvatar);
      } else if (newAvatar === null || newAvatar === '') {
        removeStoredAvatar(uid);
      }
    }
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
  try {
    localStorage.setItem(avatarStorageKey(userId), dataUrl);
  } catch (e) {
    console.warn('Could not save avatar to localStorage:', e);
  }
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
    detail: { userId: String(userId), avatarUrl: dataUrl },
  }));
}

export function removeStoredAvatar(userId) {
  if (!userId) return;
  avatarCache.set(String(userId), '');
  try {
    localStorage.removeItem(avatarStorageKey(userId));
  } catch (e) {
    // silent
  }
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
    detail: { userId: String(userId), avatarUrl: '' },
  }));
}

export function getUserAvatar(user = {}, fallbackUserId = '') {
  const isId = typeof user === 'string' || typeof user === 'number';
  const userObj = isId ? {} : (user || {});
  const userId = isId ? user : (userObj.id || userObj.user_id || userObj.userId || fallbackUserId);

  // 1. Fresh server data takes precedence if explicitly present
  const liveAvatar = userObj.avatarData || userObj.avatarUrl || userObj.userAvatar || userObj.photoUrl || userObj.imageUrl;
  if (liveAvatar) {
    if (userId) avatarCache.set(String(userId), liveAvatar);
    return liveAvatar;
  }

  // 2. If user explicitly specifies avatarData as null or empty, treat as no avatar
  if (userObj.avatarData === null || userObj.avatarData === '' || userObj.userAvatar === null) {
    if (userId && avatarCache.has(String(userId))) {
      avatarCache.delete(String(userId));
    }
    return '';
  }

  // 3. Fallback to cached/stored avatar
  if (userId) {
    const stored = getStoredAvatar(userId);
    if (stored) return stored;
  }

  return '';
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

/**
 * Client-side high-quality image compression using HTML5 Canvas
 * Prevents payload size errors (HTTP 400) and broken images on upload.
 */
export function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP)'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file hình ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể giải mã định dạng ảnh'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
