import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTracking } from '../context/TrackingContext';
import { leaderboard as leaderboardApi } from '../services/api';
import { getAppSettings, saveAppSettings, subscribeAppSettings } from '../utils/settings';
import { playPomodoroChime, requestNotificationPermission, sendBrowserNotification, vibrateDevice, openPipWindow, closePipWindow, isPipOpen } from '../utils/notifications';
import {
  Bell,
  BellOff,
  Check,
  ClipboardList,
  Coffee,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  SkipForward,
  StickyNote,
  Target,
  Timer,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';

const TimerIcon = () => <Timer size={16} />;
const CoffeeIcon = () => <Coffee size={16} />;
const PauseIcon = () => <Pause size={18} fill="currentColor" strokeWidth={0} />;
const ResetIcon = () => <RotateCcw size={16} />;
const SkipIcon = () => <SkipForward size={16} />;

const WORKRANK_NOTIFICATION_EVENT = 'workrank:notification';
const POMODORO_STORAGE_KEY = 'workrank:pomodoro-state';
const POMODORO_HISTORY_KEY = 'workrank:pomodoro-history';
const POMODORO_TASKS_KEY = 'workrank:pomodoro-tasks';
const POMODORO_ACTIVE_TASK_KEY = 'workrank:pomodoro-active-task';
const POMODORO_NOTES_KEY = 'workrank:pomodoro-notes';
const POMODORO_DAILY_GOAL_KEY = 'workrank:pomodoro-daily-goal';
const POMODORO_HISTORY_MAX = 300;
const POMODORO_TASK_MAX = 24;

function loadPomodoroHistory() {
  try {
    const raw = localStorage.getItem(POMODORO_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePomodoroHistory(history) {
  localStorage.setItem(POMODORO_HISTORY_KEY, JSON.stringify(history));
}

function createPomodoroTaskId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPomodoroTasks() {
  try {
    const raw = localStorage.getItem(POMODORO_TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((task) => task && typeof task.title === 'string')
      .map((task) => ({
        id: task.id || createPomodoroTaskId(),
        title: task.title.trim().slice(0, 90),
        estimate: Math.max(1, Math.min(12, Number(task.estimate || 1))),
        sessions: Math.max(0, Math.min(999, Number(task.sessions || 0))),
        completed: Boolean(task.completed),
        createdAt: Number(task.createdAt || Date.now()),
        completedAt: Number(task.completedAt || 0),
      }))
      .filter((task) => task.title);
  } catch { return []; }
}

function savePomodoroTasks(tasks) {
  localStorage.setItem(POMODORO_TASKS_KEY, JSON.stringify(tasks.slice(0, POMODORO_TASK_MAX)));
}

function loadPomodoroDailyGoal() {
  try {
    const value = Number(localStorage.getItem(POMODORO_DAILY_GOAL_KEY) || 120);
    return Math.max(15, Math.min(480, value || 120));
  } catch { return 120; }
}

const POMODORO_PRESETS = [
  { key: 'classic', label: '25 / 5', focusSeconds: 25 * 60, shortBreakSeconds: 5 * 60, longBreakSeconds: 15 * 60 },
  { key: 'deep', label: '50 / 10', focusSeconds: 50 * 60, shortBreakSeconds: 10 * 60, longBreakSeconds: 25 * 60 },
  { key: 'sprint', label: '15 / 3', focusSeconds: 15 * 60, shortBreakSeconds: 3 * 60, longBreakSeconds: 10 * 60 },
];

const POMODORO_MODES = {
  focus: { label: 'Tập trung', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  shortBreak: { label: 'Nghỉ ngắn', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  longBreak: { label: 'Nghỉ dài', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function getPomodoroPreset(key) {
  return POMODORO_PRESETS.find((preset) => preset.key === key) || POMODORO_PRESETS[0];
}

function getPomodoroModeSeconds(preset, mode) {
  if (mode === 'longBreak') return preset.longBreakSeconds;
  if (mode === 'shortBreak') return preset.shortBreakSeconds;
  return preset.focusSeconds;
}

function getDefaultPomodoroPresetKey() {
  return getAppSettings().pomodoro?.defaultPreset || POMODORO_PRESETS[0].key;
}

function createPomodoroState(presetKey = getDefaultPomodoroPresetKey(), mode = 'focus') {
  const preset = getPomodoroPreset(presetKey);
  return {
    presetKey: preset.key,
    mode,
    remainingSeconds: getPomodoroModeSeconds(preset, mode),
    running: false,
    completedFocusCount: 0,
    completedAt: 0,
    startedOnce: false,
    endsAt: null,
  };
}

function loadPomodoroState() {
  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return createPomodoroState();
    const parsed = JSON.parse(raw);
    if (parsed.notified || (!parsed.running && Number(parsed.completedAt || 0) > 0)) {
      return {
        presetKey: parsed.presetKey || 'classic',
        mode: parsed.mode || 'focus',
        remainingSeconds: Math.max(0, Number(parsed.remainingSeconds || 0)),
        running: false,
        completedFocusCount: Math.max(0, Number(parsed.completedFocusCount || 0)),
        completedAt: Number(parsed.completedAt || 0),
        startedOnce: Boolean(parsed.startedOnce),
        endsAt: null,
        notified: Boolean(parsed.notified),
      };
    }
    const preset = getPomodoroPreset(parsed.presetKey);
    const mode = POMODORO_MODES[parsed.mode] ? parsed.mode : 'focus';
    const fallbackRemaining = getPomodoroModeSeconds(preset, mode);
    const running = Boolean(parsed.running);
    const storedEndsAt = Number(parsed.endsAt || 0);
    let remainingSeconds = Math.max(0, Math.min(fallbackRemaining, Number(parsed.remainingSeconds || fallbackRemaining)));
    let endsAt = running ? storedEndsAt : null;
    if (running && storedEndsAt > 0) {
      remainingSeconds = Math.ceil((storedEndsAt - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        return completePomodoroStep({
          presetKey: preset.key,
          mode,
          remainingSeconds: 0,
          running: false,
          completedFocusCount: Math.max(0, Number(parsed.completedFocusCount || 0)),
          completedAt: 0,
          startedOnce: true,
          endsAt: null,
        });
      }
    } else if (running) {
      endsAt = Date.now() + remainingSeconds * 1000;
    }
    return {
      presetKey: preset.key,
      mode,
      remainingSeconds,
      running,
      completedFocusCount: Math.max(0, Number(parsed.completedFocusCount || 0)),
      completedAt: 0,
      startedOnce: Boolean(parsed.startedOnce),
      endsAt,
    };
  } catch {
    return createPomodoroState();
  }
}

function formatPomodoroTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getFriendFocusSeconds(row = {}) {
  return Number(row.active_seconds ?? row.total_active_seconds ?? row.activeSeconds ?? 0);
}

function getFriendFocusMinutes(row = {}) {
  return Math.round(Math.max(0, getFriendFocusSeconds(row)) / 60);
}

function getFriendInitial(name = '') {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

function emitWorkRankNotification(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKRANK_NOTIFICATION_EVENT, { detail }));
}

function completePomodoroStep(state) {
  const preset = getPomodoroPreset(state.presetKey);
  const completedFocusCount = state.mode === 'focus'
    ? Number(state.completedFocusCount || 0) + 1
    : Number(state.completedFocusCount || 0);
  const nextMode = state.mode === 'focus'
    ? (completedFocusCount % 4 === 0 ? 'longBreak' : 'shortBreak')
    : 'focus';
  const nextModeLabel = POMODORO_MODES[nextMode]?.label || 'phiên tiếp theo';

  const totalSeconds = getPomodoroModeSeconds(preset, state.mode);
  const elapsedSeconds = totalSeconds - Math.max(0, Number(state.remainingSeconds || 0));
  if (elapsedSeconds >= 10) {
    try {
      const history = loadPomodoroHistory();
      history.push({
        at: Date.now(),
        mode: state.mode,
        elapsed: elapsedSeconds,
        total: totalSeconds,
        preset: preset.key,
      });
      if (history.length > POMODORO_HISTORY_MAX) history.splice(0, history.length - POMODORO_HISTORY_MAX);
      savePomodoroHistory(history);
    } catch {}
  }

  emitWorkRankNotification({
    type: 'pomodoro',
    title: state.mode === 'focus' ? 'Hết phiên tập trung' : 'Hết giờ nghỉ',
    message: state.mode === 'focus'
      ? `Đến giờ ${nextModeLabel.toLowerCase()}. Pomodoro đã sẵn sàng cho bước tiếp theo.`
      : 'Đến lúc quay lại phiên tập trung tiếp theo.',
    actionTo: '/pomodoro',
    actionLabel: 'Mở Pomodoro',
  });

  return {
    ...state,
    mode: nextMode,
    remainingSeconds: getPomodoroModeSeconds(preset, nextMode),
    running: false,
    completedFocusCount,
    completedAt: Date.now(),
    startedOnce: false,
    endsAt: null,
  };
}



export default function Pomodoro() {
  const [pomodoro, setPomodoro] = useState(loadPomodoroState);
  const [pomodoroHistory, setPomodoroHistory] = useState(loadPomodoroHistory);
  const [focusTasks, setFocusTasks] = useState(loadPomodoroTasks);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskEstimate, setTaskEstimate] = useState(1);
  const [activeTaskId, setActiveTaskId] = useState(() => {
    try { return localStorage.getItem(POMODORO_ACTIVE_TASK_KEY) || ''; } catch { return ''; }
  });
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(loadPomodoroDailyGoal);
  const [focusNotes, setFocusNotes] = useState(() => {
    try { return localStorage.getItem(POMODORO_NOTES_KEY) || ''; } catch { return ''; }
  });
  const [appSettings, setAppSettings] = useState(getAppSettings);
  const [friendFocusRows, setFriendFocusRows] = useState([]);
  const [friendFocusLoading, setFriendFocusLoading] = useState(true);
  const [friendFocusError, setFriendFocusError] = useState('');
  const {
    tracking, trackingPending,
    startTrack,
  } = useTracking();

  const activePomodoroPreset = useMemo(() => getPomodoroPreset(pomodoro.presetKey), [pomodoro.presetKey]);
  const pomodoroModeMeta = POMODORO_MODES[pomodoro.mode] || POMODORO_MODES.focus;
  const pomodoroTotalSeconds = getPomodoroModeSeconds(activePomodoroPreset, pomodoro.mode);
  const pomodoroProgress = pomodoroTotalSeconds > 0
    ? Math.min(1, Math.max(0, (pomodoroTotalSeconds - pomodoro.remainingSeconds) / pomodoroTotalSeconds))
    : 0;
  const nextPomodoroMode = pomodoro.mode === 'focus'
    ? ((pomodoro.completedFocusCount + 1) % 4 === 0 ? 'Nghỉ dài' : 'Nghỉ ngắn')
    : 'Tập trung';
  const pomodoroCycle = Math.min(4, (pomodoro.completedFocusCount % 4) + 1);
  const completedInCurrentCycle = pomodoro.mode === 'longBreak' ? 4 : pomodoro.completedFocusCount % 4;
  const pomodoroTrackingReady = tracking;
  const [pomodoroSettingsOpen, setPomodoroSettingsOpen] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const pomodoroStatus = pomodoro.running
    ? 'Đang chạy'
    : pomodoro.completedAt
      ? `Sẵn sàng: ${POMODORO_MODES[pomodoro.mode]?.label || 'Phiên mới'}`
      : pomodoro.startedOnce ? 'Tạm dừng' : 'Sẵn sàng';

  const historyStats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const thisWeekStart = new Date(); thisWeekStart.setHours(0, 0, 0, 0);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const weekTs = thisWeekStart.getTime();

    let todayFocus = 0, todaySessions = 0, weekDays = {};
    let longestFocus = 0, totalFocusMin = 0, totalSessions = 0;
    let completedCount = 0, skippedCount = 0;

    pomodoroHistory.forEach((entry) => {
      if (entry.mode !== 'focus') return;
      const min = Math.round((entry.elapsed || 0) / 60);
      totalFocusMin += min;
      totalSessions++;
      if (min >= entry.total / 60 * 0.5) completedCount++;
      else skippedCount++;
      if (min > longestFocus) longestFocus = min;
      if (entry.at >= todayTs) {
        todayFocus += min;
        todaySessions++;
      }
      if (entry.at >= weekTs) {
        const day = new Date(entry.at).toLocaleDateString('vi-VN', { weekday: 'short' });
        weekDays[day] = (weekDays[day] || 0) + min;
      }
    });

    const allDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const todayName = allDays[new Date().getDay()];
    const weekLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const weekData = weekLabels.map((d) => ({ label: d, minutes: weekDays[d] || 0, isToday: d === todayName }));
    const maxWeek = Math.max(...weekData.map((d) => d.minutes), 1);

    return { todayFocus, todaySessions, totalFocusMin, totalSessions, completedCount, skippedCount, longestFocus, weekData, maxWeek };
  }, [pomodoroHistory]);
  const completionRate = historyStats.totalSessions > 0
    ? Math.round((historyStats.completedCount / historyStats.totalSessions) * 100)
    : 0;
  const avgFocusMin = historyStats.totalSessions > 0
    ? Math.round(historyStats.totalFocusMin / historyStats.totalSessions)
    : 0;
  const recentFocusHistory = useMemo(
    () => [...pomodoroHistory].reverse().filter((entry) => entry.mode === 'focus').slice(0, 30),
    [pomodoroHistory]
  );
  const openFocusTasks = useMemo(
    () => focusTasks.filter((task) => !task.completed),
    [focusTasks]
  );
  const completedFocusTasks = focusTasks.length - openFocusTasks.length;
  const activeTask = useMemo(
    () => focusTasks.find((task) => task.id === activeTaskId && !task.completed) || null,
    [activeTaskId, focusTasks]
  );
  const taskSessionTotal = focusTasks.reduce((sum, task) => sum + Number(task.sessions || 0), 0);
  const taskEstimateTotal = focusTasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
  const dailyGoalProgress = Math.min(1, historyStats.todayFocus / Math.max(1, dailyGoalMinutes));
  const sortedFriendFocusRows = useMemo(
    () => [...friendFocusRows].sort((a, b) => {
      const focusDelta = getFriendFocusSeconds(b) - getFriendFocusSeconds(a);
      if (focusDelta !== 0) return focusDelta;
      return Number(b.focusScore ?? b.score ?? 0) - Number(a.focusScore ?? a.score ?? 0);
    }),
    [friendFocusRows]
  );
  const visibleFriendFocusRows = sortedFriendFocusRows.slice(0, 6);
  const friendFocusTotalMinutes = sortedFriendFocusRows.reduce(
    (sum, row) => sum + getFriendFocusMinutes(row),
    0
  );
  const friendFocusLeader = visibleFriendFocusRows[0] || null;

  const refreshFriendFocus = async ({ silent = false } = {}) => {
    if (!silent) setFriendFocusLoading(true);
    setFriendFocusError('');
    try {
      const res = await leaderboardApi.friends('today', { limit: 8 });
      setFriendFocusRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Cannot load friend focus stats', error);
      setFriendFocusError('Không tải được dữ liệu bạn bè.');
    } finally {
      if (!silent) setFriendFocusLoading(false);
    }
  };

  useEffect(() => subscribeAppSettings(setAppSettings), []);

  useEffect(() => {
    refreshFriendFocus();
    const friendFocusInterval = window.setInterval(() => {
      refreshFriendFocus({ silent: true });
    }, 45000);
    return () => window.clearInterval(friendFocusInterval);
  }, []);

  useEffect(() => {
    savePomodoroTasks(focusTasks);
  }, [focusTasks]);

  useEffect(() => {
    try { localStorage.setItem(POMODORO_ACTIVE_TASK_KEY, activeTaskId); } catch {}
  }, [activeTaskId]);

  useEffect(() => {
    try { localStorage.setItem(POMODORO_NOTES_KEY, focusNotes); } catch {}
  }, [focusNotes]);

  useEffect(() => {
    try { localStorage.setItem(POMODORO_DAILY_GOAL_KEY, String(dailyGoalMinutes)); } catch {}
  }, [dailyGoalMinutes]);

  useEffect(() => {
    if (!activeTaskId) return;
    const selected = focusTasks.find((task) => task.id === activeTaskId);
    if (!selected || selected.completed) setActiveTaskId('');
  }, [activeTaskId, focusTasks]);

  const taskCompletionRef = useRef(pomodoro.completedAt);
  const previousPomodoroRef = useRef(pomodoro);

  useEffect(() => {
    if (!pomodoro.completedAt || taskCompletionRef.current === pomodoro.completedAt) return;
    taskCompletionRef.current = pomodoro.completedAt;
    const previousPomodoro = previousPomodoroRef.current;
    const previousPreset = getPomodoroPreset(previousPomodoro?.presetKey);
    const previousTotal = getPomodoroModeSeconds(previousPreset, previousPomodoro?.mode);
    const previousElapsed = previousTotal - Math.max(0, Number(previousPomodoro?.remainingSeconds || 0));
    if (!activeTaskId || previousPomodoro?.mode !== 'focus' || previousElapsed < 10) return;
    setFocusTasks((prev) => prev.map((task) => {
      if (task.id !== activeTaskId || task.completed) return task;
      const sessions = Math.min(999, Number(task.sessions || 0) + 1);
      const estimate = Math.max(1, Number(task.estimate || 1));
      return {
        ...task,
        sessions,
        completed: sessions >= estimate,
        completedAt: sessions >= estimate ? Date.now() : task.completedAt,
      };
    }));
  }, [activeTaskId, pomodoro.completedAt]);

  useEffect(() => {
    previousPomodoroRef.current = pomodoro;
  });

  useEffect(() => {
    setPomodoroHistory(loadPomodoroHistory());
  }, [pomodoro.completedAt]);

  useEffect(() => {
    const bc = new BroadcastChannel('workrank-pip');
    bc.onmessage = (e) => {
      if (e.data === 'continue') {
        setPomodoro(loadPomodoroState());
        return;
      }
      try {
        const cmd = typeof e.data === 'string' ? JSON.parse(e.data) : null;
        if (cmd?.command === 'pause') {
          setPomodoro((prev) => {
            const remainingSeconds = prev.endsAt
              ? Math.max(0, Math.ceil((Number(prev.endsAt || 0) - Date.now()) / 1000))
              : Math.max(0, Number(prev.remainingSeconds || 0));
            return { ...prev, remainingSeconds, running: false, endsAt: null, startedOnce: true };
          });
        } else if (cmd?.command === 'start') {
          requestNotificationPermission();
          if (
            !tracking
            && !trackingPending
            && appSettings.tracker?.autoStartWithPomodoro
          ) {
            void startTrack({ launchDesktop: Boolean(appSettings.tracker?.autoLaunchDesktop) });
          }
          setPomodoro((prev) => {
            if (prev.running) return prev;
            const preset = getPomodoroPreset(prev.presetKey);
            const remainingSeconds = Math.max(1, Number(prev.remainingSeconds || getPomodoroModeSeconds(preset, prev.mode)));
            return {
              ...prev,
              remainingSeconds,
              running: true,
              completedAt: 0,
              notified: false,
              startedOnce: true,
              endsAt: Date.now() + remainingSeconds * 1000,
            };
          });
        } else if (cmd?.command === 'skip') {
          setPomodoro((prev) => {
            const remainingSeconds = prev.endsAt
              ? Math.max(0, Math.ceil((Number(prev.endsAt || 0) - Date.now()) / 1000))
              : Math.max(0, Number(prev.remainingSeconds || 0));
            return completePomodoroStep({ ...prev, remainingSeconds, running: false, endsAt: null });
          });
        }
      } catch {}
    };
    return () => bc.close();
  }, [
    appSettings.tracker?.autoLaunchDesktop,
    appSettings.tracker?.autoStartWithPomodoro,
    startTrack,
    tracking,
    trackingPending,
  ]);

  useEffect(() => {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({
      presetKey: pomodoro.presetKey,
      mode: pomodoro.mode,
      remainingSeconds: pomodoro.remainingSeconds,
      running: pomodoro.running,
      endsAt: pomodoro.endsAt,
      completedFocusCount: pomodoro.completedFocusCount,
      startedOnce: pomodoro.startedOnce,
      completedAt: pomodoro.completedAt,
      notified: pomodoro.notified,
    }));
  }, [pomodoro]);

  useEffect(() => {
    if (!pomodoro.running) return undefined;
    const timer = window.setInterval(() => {
      setPomodoro((prev) => {
        if (!prev.running) return prev;
        const remainingSeconds = prev.endsAt
          ? Math.ceil((Number(prev.endsAt || 0) - Date.now()) / 1000)
          : Number(prev.remainingSeconds || 0) - 1;
        if (remainingSeconds > 0) {
          return { ...prev, remainingSeconds };
        }
        try {
          const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
          const stored = raw ? JSON.parse(raw) : {};
          if (stored.notified) {
            return {
              presetKey: stored.presetKey || prev.presetKey,
              mode: stored.mode || prev.mode,
              remainingSeconds: Math.max(0, Number(stored.remainingSeconds || 0)),
              running: false,
              completedFocusCount: Math.max(0, Number(stored.completedFocusCount || 0)),
              completedAt: Number(stored.completedAt || 0),
              startedOnce: false,
              endsAt: null,
              notified: true,
            };
          }
        } catch {}
        return completePomodoroStep(prev);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pomodoro.running]);

  useEffect(() => {
    if (!pomodoro.completedAt || pomodoro.notified) return;
    if (appSettings.notifications?.sound) {
      playPomodoroChime(appSettings.pomodoro?.volume ?? 0.12);
    }
    if (document.hidden) {
      requestNotificationPermission().then((permission) => {
        if (permission !== 'granted') return;
        const nextLabel = POMODORO_MODES[pomodoro.mode]?.label || '';
        sendBrowserNotification(
          pomodoro.mode === 'focus' ? 'Hết phiên tập trung' : 'Hết giờ nghỉ',
          {
            body: `Đã chuyển sang: ${nextLabel}`,
            tag: `pomodoro-${pomodoro.completedAt}`,
            data: { url: '/pomodoro' },
          }
        );
      });
    }
    vibrateDevice([200, 100, 200]);
    setFlashKey((k) => k + 1);
  }, [pomodoro.completedAt, pomodoro.mode, appSettings.notifications?.sound, appSettings.pomodoro?.volume]);

  const runningRef = useRef(pomodoro.running);
  runningRef.current = pomodoro.running;

  useEffect(() => {
    const syncPipForPomodoroPage = () => {
      if (document.hidden) {
        if (runningRef.current && !isPipOpen()) {
          openPipWindow();
        }
        return;
      }
      if (isPipOpen()) closePipWindow();
    };
    syncPipForPomodoroPage();
    document.addEventListener('visibilitychange', syncPipForPomodoroPage);
    const pipHealthInterval = window.setInterval(syncPipForPomodoroPage, 2000);
    return () => {
      document.removeEventListener('visibilitychange', syncPipForPomodoroPage);
      window.clearInterval(pipHealthInterval);
      if (runningRef.current) {
        openPipWindow();
      }
    };
  }, []);

  const setPomodoroPreset = (presetKey) => {
    setPomodoro(createPomodoroState(presetKey));
  };

  const setPomodoroMode = (mode) => {
    setPomodoro((prev) => {
      const preset = getPomodoroPreset(prev.presetKey);
      return {
        ...prev,
        mode,
        remainingSeconds: getPomodoroModeSeconds(preset, mode),
        running: false,
        completedAt: 0,
        startedOnce: false,
        endsAt: null,
      };
    });
  };

  const togglePomodoro = () => {
    if (!pomodoro.running) {
      requestNotificationPermission();
    }
    if (
      !pomodoro.running
      && pomodoro.mode === 'focus'
      && !tracking
      && !trackingPending
      && appSettings.tracker?.autoStartWithPomodoro
    ) {
      void startTrack({ launchDesktop: Boolean(appSettings.tracker?.autoLaunchDesktop) });
    }
    setPomodoro((prev) => {
      const running = !prev.running;
      return {
        ...prev,
        running,
        completedAt: 0,
        startedOnce: true,
        endsAt: running ? Date.now() + Math.max(1, Number(prev.remainingSeconds || 0)) * 1000 : null,
      };
    });
  };

  const resetPomodoro = () => {
    setPomodoro((prev) => {
      const preset = getPomodoroPreset(prev.presetKey);
      return {
        ...prev,
        remainingSeconds: getPomodoroModeSeconds(preset, prev.mode),
        running: false,
        completedAt: 0,
        startedOnce: false,
        endsAt: null,
      };
    });
  };

  const skipPomodoro = () => {
    setPomodoro((prev) => completePomodoroStep({ ...prev, running: false }));
  };

  const addFocusTask = (event) => {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;
    const estimate = Math.max(1, Math.min(12, Number(taskEstimate || 1)));
    const task = {
      id: createPomodoroTaskId(),
      title: title.slice(0, 90),
      estimate,
      sessions: 0,
      completed: false,
      createdAt: Date.now(),
      completedAt: 0,
    };
    setFocusTasks((prev) => [task, ...prev].slice(0, POMODORO_TASK_MAX));
    setTaskDraft('');
    setTaskEstimate(estimate);
    setActiveTaskId(task.id);
  };

  const toggleFocusTask = (taskId) => {
    setFocusTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const completed = !task.completed;
      return {
        ...task,
        completed,
        completedAt: completed ? Date.now() : 0,
      };
    }));
  };

  const removeFocusTask = (taskId) => {
    setFocusTasks((prev) => prev.filter((task) => task.id !== taskId));
    if (activeTaskId === taskId) setActiveTaskId('');
  };

  const adjustTaskSessions = (taskId, delta) => {
    setFocusTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const sessions = Math.max(0, Math.min(999, Number(task.sessions || 0) + delta));
      const completed = sessions >= Math.max(1, Number(task.estimate || 1));
      return {
        ...task,
        sessions,
        completed,
        completedAt: completed ? Date.now() : 0,
      };
    }));
  };

  const modeGradients = {
    focus: 'linear-gradient(160deg,#082f49 0%,#0c4a6e 100%)',
    shortBreak: 'linear-gradient(160deg,#052e16 0%,#166534 100%)',
    longBreak: 'linear-gradient(160deg,#451a03 0%,#78350f 100%)',
  };

  const timeStr = formatPomodoroTime(pomodoro.remainingSeconds);
  const digits = timeStr.split('');

  const cyclePct = completedInCurrentCycle / 4;

  const isUrgent = pomodoro.running && pomodoro.remainingSeconds <= 10;

  return (
    <div className="pm-page" style={{
      width: 'min(100%, 1120px)',
      margin: '0 auto',
      padding: '28px 16px 56px',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <style>{`
        @keyframes pm-colon-blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes pm-glow { 0%,100%{box-shadow:0 0 0 rgba(6,182,212,0)} 50%{box-shadow:0 0 20px rgba(6,182,212,0.25)} }
        @keyframes pm-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes pm-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes pm-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pm-flash { 0%{opacity:0.35} 100%{opacity:0} }
        @keyframes pm-spin { to{transform:rotate(360deg)} }
        .pm-shell{display:grid;grid-template-columns:minmax(360px,440px) minmax(0,1fr);gap:18px;align-items:start}
        .pm-primary{position:sticky;top:80px;display:flex;flex-direction:column;gap:16px;min-width:0}
        .pm-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start;min-width:0}
        .pm-primary>section,.pm-side>section{width:100%!important}
        .pm-wide{grid-column:1 / -1}
        .pm-spin{animation:pm-spin 0.8s linear infinite}
        .pm-btn:hover{filter:brightness(1.3)!important;transform:translateY(-1px)!important}
        .pm-btn:active{transform:translateY(0)!important;filter:brightness(0.95)!important}
        .pm-tile-urgent .pm-digit{color:#ef4444!important}
        .pm-tile-urgent .pm-tile-inner{box-shadow:0 0 20px rgba(239,68,68,0.35)!important;border-color:rgba(239,68,68,0.5)!important}
        .pm-settings-enter{animation:pm-fade-in 0.2s ease forwards}
        .pm-field::placeholder{color:#94a3b8}
        .pm-field:focus{outline:none;border-color:#06b6d4!important;box-shadow:0 0 0 3px rgba(6,182,212,0.12)}
        .pm-icon-btn:hover{background:#f8fafc!important;color:#0f172a!important}
        @media (max-width: 980px){
          .pm-shell{grid-template-columns:1fr}
          .pm-primary{position:static}
          .pm-side{grid-template-columns:1fr}
          .pm-wide{grid-column:auto}
        }
        @media (max-width: 520px){
          .pm-page{padding:20px 12px 44px!important}
          .pm-side{gap:12px}
          .pm-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        }
      `}</style>

      <div key={flashKey} style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'none',
        background: '#ffffff',
        animation: 'pm-flash 0.4s ease-out forwards',
      }} />

      <div className="pm-shell">
        <div className="pm-primary">
      <section style={{
        width: 'min(100%, 400px)',
        background: modeGradients[pomodoro.mode] || modeGradients.focus,
        borderRadius: 0,
        overflow: 'hidden',
        color: '#ffffff',
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pomodoroModeMeta.color,
              background: 'rgba(255,255,255,0.08)',
            }}>
              {pomodoro.mode === 'focus' ? <TimerIcon /> : <CoffeeIcon />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.2px', color: '#ffffff' }}>Pomodoro</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                Chu kỳ {pomodoroCycle}/4 · Tiếp theo: {nextPomodoroMode}
              </div>
            </div>
          </div>
          <span style={{
            padding: '4px 8px',
            background: pomodoro.running ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
            color: pomodoro.running ? '#22c55e' : 'rgba(255,255,255,0.6)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.05em',
            transition: 'background 0.3s, color 0.3s',
          }}>
            {pomodoroStatus}
          </span>
        </div>

        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${Math.round(cyclePct * 100)}%`,
            background: pomodoroModeMeta.color,
            transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ padding: '16px 20px 18px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {POMODORO_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                data-no-track="true"
                onClick={() => setPomodoroPreset(preset.key)}
                className="pm-btn"
                style={{
                  flex: 1,
                  height: 32,
                  border: activePomodoroPreset.key === preset.key
                    ? `1px solid ${pomodoroModeMeta.color}`
                    : '1px solid rgba(255,255,255,0.1)',
                  background: activePomodoroPreset.key === preset.key
                    ? pomodoroModeMeta.bg
                    : 'rgba(255,255,255,0.04)',
                  color: activePomodoroPreset.key === preset.key
                    ? pomodoroModeMeta.color
                    : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  transition: 'all 0.2s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
            {[
              ['focus', 'Tập trung'],
              ['shortBreak', 'Nghỉ ngắn'],
              ['longBreak', 'Nghỉ dài'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                data-no-track="true"
                onClick={() => setPomodoroMode(mode)}
                className="pm-btn"
                style={{
                  height: 28,
                  border: pomodoro.mode === mode
                    ? `1px solid ${POMODORO_MODES[mode].color}`
                    : '1px solid rgba(255,255,255,0.08)',
                  background: pomodoro.mode === mode
                    ? POMODORO_MODES[mode].bg
                    : 'rgba(255,255,255,0.03)',
                  color: pomodoro.mode === mode
                    ? POMODORO_MODES[mode].color
                    : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 800,
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            border: `1px solid ${pomodoroTrackingReady ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            background: pomodoroTrackingReady ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
            marginBottom: 14,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: pomodoroTrackingReady ? '#22c55e' : '#f59e0b',
              flexShrink: 0,
            }} />
            <span style={{
              minWidth: 0,
              flex: 1,
              fontSize: 10,
              lineHeight: 1.35,
              fontWeight: 700,
              color: pomodoroTrackingReady ? 'rgba(34,197,94,0.85)' : 'rgba(245,158,11,0.85)',
            }}>
              {pomodoroTrackingReady ? 'Tracker đang ghi nhận cùng Pomodoro' : 'Tracker chưa chạy, bật khi bắt đầu focus'}
            </span>
            {!pomodoroTrackingReady && (
              <button
                type="button"
                data-no-track="true"
                disabled={trackingPending}
                onClick={() => { void startTrack({ launchDesktop: true }); }}
                className="pm-btn"
                style={{
                  flexShrink: 0,
                  height: 24,
                  padding: '0 8px',
                  border: '1px solid rgba(245,158,11,0.25)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#f59e0b',
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: trackingPending ? 'wait' : 'pointer',
                  opacity: trackingPending ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                Bật
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
            <button
              type="button"
              data-no-track="true"
              aria-label="Cửa sổ nổi"
              onClick={() => { if (isPipOpen()) closePipWindow(); }}
              className="pm-btn"
              style={{
                height: 26,
                padding: '0 7px',
                border: isPipOpen()
                  ? `1px solid ${pomodoroModeMeta.color}`
                  : '1px solid rgba(255,255,255,0.1)',
                background: isPipOpen() ? pomodoroModeMeta.bg : 'rgba(255,255,255,0.04)',
                color: isPipOpen() ? pomodoroModeMeta.color : 'rgba(255,255,255,0.5)',
                cursor: isPipOpen() ? 'pointer' : 'default',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s ease',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              {isPipOpen() ? 'Ẩn' : 'PiP tắt'}
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Cài đặt Pomodoro"
              onClick={() => setPomodoroSettingsOpen((v) => !v)}
              className="pm-btn"
              style={{
                height: 26,
                padding: '0 7px',
                border: pomodoroSettingsOpen
                  ? `1px solid ${pomodoroModeMeta.color}`
                  : '1px solid rgba(255,255,255,0.1)',
                background: pomodoroSettingsOpen ? pomodoroModeMeta.bg : 'rgba(255,255,255,0.04)',
                color: pomodoroSettingsOpen ? pomodoroModeMeta.color : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s ease',
              }}
            >
              <Settings size={12} />
              Cài đặt
            </button>
          </div>

          {pomodoroSettingsOpen && (
            <div className="pm-settings-enter" style={{
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.7)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Tùy chọn
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Volume2 size={11} />
                    Âm báo
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(appSettings.notifications?.sound)}
                    onChange={(e) => {
                      saveAppSettings({
                        ...appSettings,
                        notifications: { ...appSettings.notifications, sound: e.target.checked },
                      });
                    }}
                    style={{ accentColor: pomodoroModeMeta.color }}
                  />
                </label>

                {appSettings.notifications?.sound && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                    <Volume2 size={11} />
                    <span style={{ minWidth: 30 }}>Âm lượng</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round((appSettings.pomodoro?.volume ?? 0.12) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        saveAppSettings({
                          ...appSettings,
                          pomodoro: { ...appSettings.pomodoro, volume: val },
                        });
                      }}
                      style={{ flex: 1, height: 3, accentColor: pomodoroModeMeta.color }}
                    />
                    <span style={{ minWidth: 26, textAlign: 'right', color: 'rgba(255,255,255,0.4)' }}>
                      {Math.round((appSettings.pomodoro?.volume ?? 0.12) * 100)}%
                    </span>
                  </div>
                )}

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {appSettings.notifications?.pomodoro ? <Bell size={11} /> : <BellOff size={11} />}
                    Thông báo
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(appSettings.notifications?.pomodoro)}
                    onChange={(e) => {
                      saveAppSettings({
                        ...appSettings,
                        notifications: { ...appSettings.notifications, pomodoro: e.target.checked },
                      });
                    }}
                    style={{ accentColor: pomodoroModeMeta.color }}
                  />
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Monitor size={11} />
                    Tự bật tracker
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(appSettings.tracker?.autoStartWithPomodoro)}
                    onChange={(e) => {
                      saveAppSettings({
                        ...appSettings,
                        tracker: { ...appSettings.tracker, autoStartWithPomodoro: e.target.checked },
                      });
                    }}
                    style={{ accentColor: pomodoroModeMeta.color }}
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ margin: '0 0 16px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textAlign: 'center',
              marginBottom: 14,
            }}>
              {pomodoroModeMeta.label}
            </div>
            <div className={isUrgent ? 'pm-tile-urgent' : ''} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              {[0, 1, 3, 4].map((i) => (
                <div key={i} className="pm-tile-inner" style={{
                  width: 64,
                  height: 70,
                  background: isUrgent
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  backdropFilter: 'blur(8px)',
                  border: isUrgent
                    ? '1px solid rgba(239,68,68,0.35)'
                    : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.3s ease',
                  boxShadow: isUrgent
                    ? '0 0 20px rgba(239,68,68,0.25)'
                    : '0 4px 16px rgba(0,0,0,0.15)',
                  animation: isUrgent ? 'pm-glow 1s ease-in-out infinite' : 'none',
                }}>
                  <span className="pm-digit" style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 44,
                    fontWeight: 900,
                    color: isUrgent ? '#ef4444' : '#ffffff',
                    lineHeight: 1,
                    textShadow: isUrgent
                      ? '0 0 20px rgba(239,68,68,0.5)'
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'color 0.3s ease',
                  }}>
                    {digits[i] === ':' ? '' : digits[i]}
                  </span>
                </div>
              ))}
              <div style={{
                fontSize: 32,
                fontWeight: 900,
                color: isUrgent ? '#ef4444' : '#ffffff',
                lineHeight: 1,
                paddingBottom: 6,
                animation: 'pm-colon-blink 1s step-end infinite',
                textShadow: isUrgent ? '0 0 15px rgba(239,68,68,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'color 0.3s ease',
                width: 10,
                textAlign: 'center',
              }}>
                :
              </div>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(pomodoroProgress * 100)}%`,
                background: pomodoroModeMeta.color,
                borderRadius: 2,
                transition: 'width 0.3s ease',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)`,
                  animation: 'pm-shimmer 2s ease-in-out infinite',
                }} />
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 38px 38px',
            gap: 6,
            marginBottom: 14,
          }}>
            <button
              type="button"
              data-no-track="true"
              onClick={togglePomodoro}
              className="pm-btn"
              style={{
                height: 42,
                border: 'none',
                background: pomodoro.running
                  ? 'rgba(255,255,255,0.1)'
                  : pomodoroModeMeta.color,
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              {pomodoro.running ? <PauseIcon /> : <Play size={16} fill="currentColor" strokeWidth={0} />}
              {pomodoro.running ? 'Tạm dừng' : 'Bắt đầu'}
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Reset Pomodoro"
              onClick={resetPomodoro}
              className="pm-btn"
              style={{
                height: 42,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <ResetIcon />
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Chuyển phiên Pomodoro"
              onClick={skipPomodoro}
              className="pm-btn"
              style={{
                height: 42,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <SkipIcon />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            <div style={{
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                Phiên tập trung
              </div>
              <div style={{ marginTop: 3, fontSize: 20, fontWeight: 900, color: '#ffffff', fontFamily: "'JetBrains Mono',monospace" }}>
                {pomodoro.completedFocusCount}
              </div>
            </div>
            <div style={{
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                Tổng focus
              </div>
              <div style={{ marginTop: 3, fontSize: 20, fontWeight: 900, color: '#ffffff', fontFamily: "'JetBrains Mono',monospace" }}>
                {Math.round((pomodoro.completedFocusCount * activePomodoroPreset.focusSeconds) / 60)}p
              </div>
            </div>
          </div>
        </div>
      </section>
        </div>

        <div className="pm-side">
      <section className="pm-wide" style={{
        width: 'min(100%, 400px)',
        border: '1px solid rgba(15,23,42,0.08)',
        background: '#ffffff',
        padding: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <Users size={15} color="#0ea5e9" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Focus bạn bè hôm nay</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                Dữ liệu từ BXH bạn bè
              </div>
            </div>
          </div>
          <button
            type="button"
            data-no-track="true"
            onClick={() => refreshFriendFocus()}
            disabled={friendFocusLoading}
            className="pm-icon-btn"
            style={{
              height: 28,
              padding: '0 9px',
              border: '1px solid rgba(15,23,42,0.1)',
              background: '#ffffff',
              color: '#64748b',
              cursor: friendFocusLoading ? 'wait' : 'pointer',
              fontSize: 10,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              opacity: friendFocusLoading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={13} className={friendFocusLoading ? 'pm-spin' : ''} />
            Mới
          </button>
        </div>
        <div style={{ padding: '14px 18px 16px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 12,
          }}>
            <div style={{ border: '1px solid rgba(15,23,42,0.08)', padding: '10px 11px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 900 }}>BẠN BÈ</div>
              <div style={{ marginTop: 4, fontSize: 20, color: '#0f172a', fontWeight: 900 }}>
                {sortedFriendFocusRows.length}
              </div>
            </div>
            <div style={{ border: '1px solid rgba(15,23,42,0.08)', padding: '10px 11px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 900 }}>TỔNG PHÚT</div>
              <div style={{ marginTop: 4, fontSize: 20, color: '#0f172a', fontWeight: 900 }}>
                {friendFocusTotalMinutes}p
              </div>
            </div>
            <div style={{ border: '1px solid rgba(15,23,42,0.08)', padding: '10px 11px', background: '#f8fafc', minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 900 }}>DẪN ĐẦU</div>
              <div style={{
                marginTop: 4,
                fontSize: 14,
                color: '#0f172a',
                fontWeight: 900,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {friendFocusLeader ? friendFocusLeader.name : '--'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {friendFocusLoading && visibleFriendFocusRows.length === 0 ? (
              <div style={{ padding: '16px 0 2px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>
                Đang tải thống kê bạn bè...
              </div>
            ) : friendFocusError ? (
              <div style={{ padding: '16px 0 2px', color: '#ef4444', fontSize: 11, fontWeight: 800 }}>
                {friendFocusError}
              </div>
            ) : visibleFriendFocusRows.length === 0 ? (
              <div style={{ padding: '16px 0 2px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>
                Chưa có bạn bè có dữ liệu focus hôm nay.
              </div>
            ) : visibleFriendFocusRows.map((friend, index) => {
              const minutes = getFriendFocusMinutes(friend);
              const leaderSeconds = Math.max(1, getFriendFocusSeconds(visibleFriendFocusRows[0]));
              const progress = Math.min(1, getFriendFocusSeconds(friend) / leaderSeconds);
              const score = Math.round(Number(friend.focusScore ?? friend.score ?? 0));
              return (
                <div key={friend.user_id || friend.id || `${friend.name}-${index}`} style={{
                  display: 'grid',
                  gridTemplateColumns: '26px 32px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(15,23,42,0.05)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: index === 0 ? '#0ea5e9' : '#94a3b8' }}>
                    #{index + 1}
                  </div>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: index === 0 ? '#e0f2fe' : '#f1f5f9',
                    color: index === 0 ? '#0284c7' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                  }}>
                    {getFriendInitial(friend.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {friend.name}
                    </div>
                    <div style={{ height: 4, marginTop: 7, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round(progress * 100)}%`,
                        height: '100%',
                        background: index === 0 ? '#0ea5e9' : '#94a3b8',
                      }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>{minutes}p</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', marginTop: 2 }}>{score} điểm</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{
        width: 'min(100%, 400px)',
        border: '1px solid rgba(15,23,42,0.08)',
        background: '#ffffff',
        padding: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <Target size={15} color="#06b6d4" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Mục tiêu hôm nay</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                {historyStats.todayFocus}p / {dailyGoalMinutes}p
              </div>
            </div>
          </div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#64748b',
            fontSize: 10,
            fontWeight: 800,
          }}>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              value={dailyGoalMinutes}
              onChange={(event) => {
                const value = Math.max(15, Math.min(480, Number(event.target.value || 15)));
                setDailyGoalMinutes(value);
              }}
              className="pm-field"
              style={{
                width: 62,
                height: 28,
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 11,
                fontWeight: 900,
                padding: '0 7px',
                fontFamily: "'JetBrains Mono',monospace",
              }}
            />
            phút
          </label>
        </div>
        <div style={{ padding: '12px 18px 16px' }}>
          <div style={{
            height: 5,
            background: 'rgba(15,23,42,0.07)',
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <div style={{
              width: `${Math.round(dailyGoalProgress * 100)}%`,
              height: '100%',
              background: dailyGoalProgress >= 1 ? '#22c55e' : '#06b6d4',
              transition: 'width 0.25s ease',
            }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 800 }}>ĐANG MỞ</div>
              <div style={{ marginTop: 3, fontSize: 18, color: '#0f172a', fontWeight: 900 }}>{openFocusTasks.length}</div>
            </div>
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 800 }}>ĐÃ XONG</div>
              <div style={{ marginTop: 3, fontSize: 18, color: '#0f172a', fontWeight: 900 }}>{completedFocusTasks}</div>
            </div>
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 800 }}>PHIÊN TASK</div>
              <div style={{ marginTop: 3, fontSize: 18, color: '#0f172a', fontWeight: 900 }}>
                {taskSessionTotal}/{taskEstimateTotal}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pm-wide" style={{
        width: 'min(100%, 400px)',
        border: '1px solid rgba(15,23,42,0.08)',
        background: '#ffffff',
        padding: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ClipboardList size={15} color="#0f172a" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Việc focus</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginTop: 2 }}>
                {activeTask ? activeTask.title : 'Chưa ghim việc'}
              </div>
            </div>
          </div>
          {completedFocusTasks > 0 && (
            <button
              type="button"
              data-no-track="true"
              onClick={() => setFocusTasks((prev) => prev.filter((task) => !task.completed))}
              className="pm-icon-btn"
              style={{
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#ffffff',
                color: '#64748b',
                height: 26,
                padding: '0 8px',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Trash2 size={12} />
              Dọn
            </button>
          )}
        </div>
        <div style={{ padding: '14px 18px 16px' }}>
          <form onSubmit={addFocusTask} style={{ display: 'grid', gridTemplateColumns: '1fr 62px 34px', gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={taskDraft}
              onChange={(event) => setTaskDraft(event.target.value)}
              placeholder="Việc cần làm"
              maxLength={90}
              className="pm-field"
              style={{
                minWidth: 0,
                height: 34,
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#ffffff',
                color: '#0f172a',
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 800,
              }}
            />
            <input
              type="number"
              min="1"
              max="12"
              value={taskEstimate}
              onChange={(event) => setTaskEstimate(Math.max(1, Math.min(12, Number(event.target.value || 1))))}
              aria-label="Số phiên dự kiến"
              className="pm-field"
              style={{
                height: 34,
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#ffffff',
                color: '#0f172a',
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 900,
                fontFamily: "'JetBrains Mono',monospace",
              }}
            />
            <button
              type="submit"
              data-no-track="true"
              disabled={!taskDraft.trim()}
              aria-label="Thêm việc focus"
              className="pm-btn"
              style={{
                height: 34,
                border: 'none',
                background: taskDraft.trim() ? '#0f172a' : '#cbd5e1',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: taskDraft.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Plus size={16} />
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {focusTasks.length === 0 ? (
              <div style={{ padding: '18px 0 4px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>
                Chưa có việc focus.
              </div>
            ) : focusTasks.slice(0, 10).map((task) => {
              const estimate = Math.max(1, Number(task.estimate || 1));
              const sessions = Math.max(0, Number(task.sessions || 0));
              const selected = activeTaskId === task.id && !task.completed;
              return (
                <div key={task.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '26px 1fr auto auto auto auto',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 0',
                  borderBottom: '1px solid rgba(15,23,42,0.05)',
                }}>
                  <button
                    type="button"
                    data-no-track="true"
                    aria-label={task.completed ? 'Mở lại việc' : 'Hoàn thành việc'}
                    onClick={() => toggleFocusTask(task.id)}
                    className="pm-icon-btn"
                    style={{
                      width: 24,
                      height: 24,
                      border: `1px solid ${task.completed ? '#22c55e' : 'rgba(15,23,42,0.14)'}`,
                      background: task.completed ? '#22c55e' : '#ffffff',
                      color: task.completed ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: task.completed ? '#94a3b8' : '#0f172a',
                      textDecoration: task.completed ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                      {Array.from({ length: estimate }).map((_, index) => (
                        <span key={index} style={{
                          width: 12,
                          height: 3,
                          background: index < sessions ? '#06b6d4' : 'rgba(15,23,42,0.12)',
                        }} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-no-track="true"
                    aria-label="Giảm phiên đã làm"
                    onClick={() => adjustTaskSessions(task.id, -1)}
                    className="pm-icon-btn"
                    style={{
                      width: 24,
                      height: 24,
                      border: '1px solid rgba(15,23,42,0.1)',
                      background: '#ffffff',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    data-no-track="true"
                    aria-label="Tăng phiên đã làm"
                    onClick={() => adjustTaskSessions(task.id, 1)}
                    className="pm-icon-btn"
                    style={{
                      width: 24,
                      height: 24,
                      border: '1px solid rgba(15,23,42,0.1)',
                      background: '#ffffff',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={13} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    data-no-track="true"
                    aria-label="Ghim việc focus"
                    onClick={() => setActiveTaskId(selected ? '' : task.id)}
                    disabled={task.completed}
                    className="pm-icon-btn"
                    style={{
                      width: 24,
                      height: 24,
                      border: selected ? '1px solid #06b6d4' : '1px solid rgba(15,23,42,0.1)',
                      background: selected ? 'rgba(6,182,212,0.12)' : '#ffffff',
                      color: selected ? '#0284c7' : '#64748b',
                      cursor: task.completed ? 'not-allowed' : 'pointer',
                      opacity: task.completed ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Target size={13} />
                  </button>
                  <button
                    type="button"
                    data-no-track="true"
                    aria-label="Xóa việc focus"
                    onClick={() => removeFocusTask(task.id)}
                    className="pm-icon-btn"
                    style={{
                      width: 24,
                      height: 24,
                      border: '1px solid rgba(15,23,42,0.1)',
                      background: '#ffffff',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pm-wide" style={{
        width: 'min(100%, 400px)',
        border: '1px solid rgba(15,23,42,0.08)',
        background: '#ffffff',
        padding: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px 10px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <StickyNote size={15} color="#f59e0b" />
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Ghi chú nhanh</div>
          </div>
          {focusNotes.trim() && (
            <button
              type="button"
              data-no-track="true"
              onClick={() => setFocusNotes('')}
              className="pm-icon-btn"
              style={{
                width: 26,
                height: 26,
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#ffffff',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Xóa ghi chú"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <div style={{ padding: '14px 18px 16px' }}>
          <textarea
            value={focusNotes}
            onChange={(event) => setFocusNotes(event.target.value)}
            placeholder={activeTask ? `Ghi chú cho ${activeTask.title}` : 'Ghi chú trong phiên focus'}
            className="pm-field"
            style={{
              width: '100%',
              minHeight: 108,
              resize: 'vertical',
              border: '1px solid rgba(15,23,42,0.12)',
              background: '#ffffff',
              color: '#0f172a',
              padding: '10px 11px',
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </section>

      {/* ── Stats Dashboard ── */}
      <section style={{ width: 'min(100%, 400px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          ...(historyStats.todaySessions === 0 && historyStats.totalSessions === 0 ? { opacity: 0.4 } : {}),
        }} className="pm-stats-grid">
          <div style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '14px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>Hôm nay</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
              {historyStats.todayFocus}p
            </div>
          </div>
          <div style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '14px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>Tổng focus</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
              {historyStats.totalFocusMin}p
            </div>
          </div>
          <div style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '14px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>Trung bình</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
              {avgFocusMin}p
            </div>
          </div>
          <div style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '14px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>Kỷ lục</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
              {historyStats.longestFocus}p
            </div>
          </div>
          <div style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '14px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>Tỉ lệ</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
              {completionRate}%
            </div>
          </div>
        </div>
      </section>

      {/* ── Weekly Focus Bar Chart ── */}
      {historyStats.totalSessions > 0 && (
        <section className="pm-wide" style={{ width: 'min(100%, 400px)', border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 14 }}>Focus trong tuần</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {historyStats.weekData.map((day) => {
              const heightPct = historyStats.maxWeek > 0 ? (day.minutes / historyStats.maxWeek) * 100 : 0;
              return (
                <div key={day.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(4, heightPct)}%`,
                    background: day.isToday ? '#06b6d4' : 'rgba(15,23,42,0.1)',
                    minHeight: 4,
                    transition: 'height 0.3s ease',
                    position: 'relative',
                  }}>
                    {day.minutes > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 9,
                        fontWeight: 900,
                        color: '#64748b',
                        fontFamily: "'JetBrains Mono',monospace",
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                      }}>
                        {day.minutes}p
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: day.isToday ? '#06b6d4' : '#94a3b8',
                    fontFamily: "'JetBrains Mono',monospace",
                  }}>
                    {day.label}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Session History List ── */}
      <section className="pm-wide" style={{ width: 'min(100%, 400px)', border: '1px solid rgba(15,23,42,0.08)', background: '#ffffff', padding: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', padding: '16px 18px 0' }}>Lịch sử phiên</div>
        <div style={{
          maxHeight: 280,
          overflowY: 'auto',
          marginTop: 10,
        }}>
          {recentFocusHistory.length === 0 ? (
            <div style={{
              padding: '14px 18px 18px',
              borderTop: '1px solid rgba(15,23,42,0.06)',
              color: '#94a3b8',
              fontSize: 11,
              fontWeight: 800,
            }}>
              Chưa có phiên focus.
            </div>
          ) : recentFocusHistory.map((entry, idx) => {
              const d = new Date(entry.at);
              const timeLabel = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const dateLabel = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
              const min = Math.round((entry.elapsed || 0) / 60);
              const plannedMin = Math.round((entry.total || 0) / 60);
              const completed = min >= plannedMin * 0.5;
              return (
                <div key={`${entry.at}-${idx}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  borderTop: idx === 0 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                  borderBottom: '1px solid rgba(15,23,42,0.04)',
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: completed ? '#22c55e' : '#f59e0b',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                      {min}p / {plannedMin}p
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>
                      {dateLabel} · {timeLabel} · {entry.preset}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: completed ? '#16a34a' : '#ca8a04',
                    fontFamily: "'JetBrains Mono',monospace",
                    whiteSpace: 'nowrap',
                  }}>
                    {completed ? 'XONG' : 'BỎ LỠ'}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

        </div>
      </div>
    </div>
  );
}
