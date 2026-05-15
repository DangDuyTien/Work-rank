export const APP_SETTINGS_KEY = 'workrank:app-settings:v1';
export const APP_SETTINGS_UPDATED_EVENT = 'workrank:app-settings-updated';

export const DEFAULT_APP_SETTINGS = {
  notifications: {
    activityMilestones: true,
    trackerIdle: true,
    pomodoro: true,
    contests: true,
    security: true,
    sound: true,
  },
  tracker: {
    autoLaunchDesktop: true,
    autoStartWithPomodoro: true,
  },
  pomodoro: {
    defaultPreset: 'classic',
  },
  appearance: {
    density: 'comfortable',
    reduceMotion: false,
    highContrast: false,
  },
};

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeSettings(base, override) {
  const result = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if (isObject(value) && isObject(base[key])) {
      result[key] = mergeSettings(base[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
}

export function getAppSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
    return mergeSettings(DEFAULT_APP_SETTINGS, isObject(parsed) ? parsed : {});
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings) {
  const next = mergeSettings(DEFAULT_APP_SETTINGS, settings || {});
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_UPDATED_EVENT, { detail: next }));
  return next;
}

export function resetAppSettings() {
  localStorage.removeItem(APP_SETTINGS_KEY);
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_UPDATED_EVENT, { detail: DEFAULT_APP_SETTINGS }));
  return DEFAULT_APP_SETTINGS;
}

export function subscribeAppSettings(listener) {
  const handler = (event) => listener(event.detail || getAppSettings());
  window.addEventListener(APP_SETTINGS_UPDATED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function shouldStoreNotification(type, settings = getAppSettings()) {
  const notifications = settings.notifications || DEFAULT_APP_SETTINGS.notifications;
  if (type === 'success') return notifications.activityMilestones;
  if (type === 'warning') return notifications.trackerIdle;
  if (type === 'pomodoro') return notifications.pomodoro;
  if (type === 'contest') return notifications.contests;
  if (type === 'security' || type === 'danger') return notifications.security;
  return true;
}
