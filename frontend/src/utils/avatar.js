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
  const userId = user?.id || user?.user_id || user?.userId || fallbackUserId;
  const stored = getStoredAvatar(userId);
  if (stored) return stored;
  return user?.avatarData || user?.avatarUrl || user?.photoUrl || user?.imageUrl || '';
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
