import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTracking } from '../context/TrackingContext';
import { getAppSettings, saveAppSettings, subscribeAppSettings } from '../utils/settings';
import { playPomodoroChime, playTickSound, requestNotificationPermission, sendBrowserNotification, vibrateDevice, openPipWindow, closePipWindow, isPipOpen } from '../utils/notifications';
import {
  Bell,
  BellOff,
  Coffee,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Timer,
  Volume2,
} from 'lucide-react';

const TimerIcon = () => <Timer size={16} />;
const CoffeeIcon = () => <Coffee size={16} />;
const PauseIcon = () => <Pause size={18} fill="currentColor" strokeWidth={0} />;
const ResetIcon = () => <RotateCcw size={16} />;
const SkipIcon = () => <SkipForward size={16} />;

const WORKRANK_NOTIFICATION_EVENT = 'workrank:notification';
const POMODORO_STORAGE_KEY = 'workrank:pomodoro-state';
const POMODORO_PRESETS = [
  { key: 'classic', label: '25 / 5', focusSeconds: 25 * 60, shortBreakSeconds: 5 * 60, longBreakSeconds: 15 * 60 },
  { key: 'deep', label: '50 / 10', focusSeconds: 50 * 60, shortBreakSeconds: 10 * 60, longBreakSeconds: 25 * 60 },
  { key: 'sprint', label: '15 / 3', focusSeconds: 15 * 60, shortBreakSeconds: 3 * 60, longBreakSeconds: 10 * 60 },
];

const POMODORO_MODES = {
  focus: { label: 'Tập trung', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  shortBreak: { label: 'Nghỉ ngắn', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  longBreak: { label: 'Nghỉ dài', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
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
  const [appSettings, setAppSettings] = useState(getAppSettings);
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
  const pomodoroStatus = pomodoro.running
    ? 'Đang chạy'
    : pomodoro.completedAt
      ? `Sẵn sàng: ${POMODORO_MODES[pomodoro.mode]?.label || 'Phiên mới'}`
      : pomodoro.startedOnce ? 'Tạm dừng' : 'Sẵn sàng';

  useEffect(() => subscribeAppSettings(setAppSettings), []);

  useEffect(() => {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({
      presetKey: pomodoro.presetKey,
      mode: pomodoro.mode,
      remainingSeconds: pomodoro.remainingSeconds,
      running: pomodoro.running,
      endsAt: pomodoro.endsAt,
      completedFocusCount: pomodoro.completedFocusCount,
      startedOnce: pomodoro.startedOnce,
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
        return completePomodoroStep(prev);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pomodoro.running]);

  useEffect(() => {
    if (!pomodoro.running || pomodoro.remainingSeconds <= 0) return;
    playTickSound(appSettings.pomodoro?.volume ?? 0.12);
  }, [pomodoro.remainingSeconds, pomodoro.running, appSettings.pomodoro?.volume]);

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
  }, [pomodoro.completedAt, pomodoro.mode, appSettings.notifications?.sound, appSettings.pomodoro?.volume]);

  const runningRef = useRef(pomodoro.running);
  runningRef.current = pomodoro.running;

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && runningRef.current) {
        openPipWindow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
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

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: 32,
    }}>
      <section style={{
        width: 400,
        background: '#ffffff',
        borderRadius: 0,
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: 'none',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#0f172a',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pomodoroModeMeta.color,
              background: pomodoroModeMeta.bg,
            }}>
              {pomodoro.mode === 'focus' ? <TimerIcon /> : <CoffeeIcon />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.2px' }}>Pomodoro</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                Chu kỳ {pomodoroCycle}/4 · Tiếp theo: {nextPomodoroMode}
              </div>
            </div>
          </div>
          <span style={{
            padding: '5px 8px',
            borderRadius: 0,
            background: pomodoro.running ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.1)',
            color: pomodoro.running ? '#16a34a' : '#64748b',
            fontSize: 11,
            fontWeight: 800,
          }}>
            {pomodoroStatus}
          </span>
        </div>

        <div style={{ padding: '18px 20px 18px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {POMODORO_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                data-no-track="true"
                onClick={() => setPomodoroPreset(preset.key)}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 0,
                  border: activePomodoroPreset.key === preset.key ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(15,23,42,0.09)',
                  background: activePomodoroPreset.key === preset.key ? 'rgba(56,189,248,0.1)' : '#f8fafc',
                  color: activePomodoroPreset.key === preset.key ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
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
                style={{
                  height: 32,
                  borderRadius: 0,
                  border: pomodoro.mode === mode ? `1px solid ${POMODORO_MODES[mode].color}` : '1px solid rgba(15,23,42,0.08)',
                  background: pomodoro.mode === mode ? POMODORO_MODES[mode].bg : '#ffffff',
                  color: pomodoro.mode === mode ? POMODORO_MODES[mode].color : '#64748b',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
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
            padding: '10px 11px',
            borderRadius: 0,
            border: `1px solid ${pomodoroTrackingReady ? 'rgba(34,197,94,0.22)' : 'rgba(217,119,6,0.22)'}`,
            background: pomodoroTrackingReady ? 'rgba(34,197,94,0.06)' : 'rgba(217,119,6,0.07)',
            marginBottom: 14,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: pomodoroTrackingReady ? '#22c55e' : '#f59e0b',
              boxShadow: 'none',
              flexShrink: 0,
            }} />
            <span style={{
              minWidth: 0,
              flex: 1,
              fontSize: 11,
              lineHeight: 1.35,
              fontWeight: 700,
              color: pomodoroTrackingReady ? '#16a34a' : '#b45309',
            }}>
              {pomodoroTrackingReady ? 'Tracker đang ghi nhận cùng Pomodoro' : 'Tracker chưa chạy, bật khi bắt đầu focus'}
            </span>
            {!pomodoroTrackingReady && (
              <button
                type="button"
                data-no-track="true"
                disabled={trackingPending}
                onClick={() => { void startTrack({ launchDesktop: true }); }}
                style={{
                  flexShrink: 0,
                  height: 26,
                  padding: '0 9px',
                  borderRadius: 0,
                  border: '1px solid rgba(217,119,6,0.25)',
                  background: '#ffffff',
                  color: '#b45309',
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: trackingPending ? 'wait' : 'pointer',
                  opacity: trackingPending ? 0.6 : 1,
                }}
              >
                Bật
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
            <button
              type="button"
              data-no-track="true"
              aria-label="Cửa sổ nổi"
              onClick={() => { if (isPipOpen()) closePipWindow(); else openPipWindow(); }}
              style={{
                height: 28,
                padding: '0 8px',
                borderRadius: 0,
                border: isPipOpen() ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(15,23,42,0.08)',
                background: isPipOpen() ? 'rgba(56,189,248,0.08)' : '#f8fafc',
                color: isPipOpen() ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              {isPipOpen() ? 'Ẩn' : 'Nổi'}
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Cài đặt Pomodoro"
              onClick={() => setPomodoroSettingsOpen((v) => !v)}
              style={{
                height: 28,
                padding: '0 8px',
                borderRadius: 0,
                border: pomodoroSettingsOpen ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(15,23,42,0.08)',
                background: pomodoroSettingsOpen ? 'rgba(56,189,248,0.08)' : '#f8fafc',
                color: pomodoroSettingsOpen ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Settings size={13} />
              Cài đặt
            </button>
          </div>

          {pomodoroSettingsOpen && (
            <div style={{
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 0,
              padding: '12px 14px',
              background: '#f8fafc',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                Tùy chọn Pomodoro
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {appSettings.notifications?.sound ? <Volume2 size={13} /> : <Volume2 size={13} />}
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
                  />
                </label>

                {appSettings.notifications?.sound && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#475569' }}>
                    <Volume2 size={13} />
                    <span style={{ minWidth: 34 }}>Âm lượng</span>
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
                      style={{ flex: 1, height: 4 }}
                    />
                    <span style={{ minWidth: 30, textAlign: 'right', color: '#64748b' }}>
                      {Math.round((appSettings.pomodoro?.volume ?? 0.12) * 100)}%
                    </span>
                  </div>
                )}

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {appSettings.notifications?.pomodoro ? <Bell size={13} /> : <BellOff size={13} />}
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
                  />
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Monitor size={13} />
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
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
            {Array.from({ length: 4 }).map((_, index) => {
              const step = index + 1;
              const done = step <= completedInCurrentCycle;
              const active = pomodoro.mode === 'focus' && step === pomodoroCycle;
              return (
                <div
                  key={step}
                  title={`Chu kỳ ${step}`}
                  style={{
                    height: 8,
                    borderRadius: 0,
                    background: done
                      ? '#22c55e'
                      : active
                        ? pomodoroModeMeta.color
                        : 'rgba(15,23,42,0.08)',
                    boxShadow: 'none',
                    transition: 'background 0.2s ease, box-shadow 0.2s ease',
                  }}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 18px' }}>
            <div style={{
              width: 168,
              height: 168,
              borderRadius: '50%',
              padding: 10,
              background: `conic-gradient(${pomodoroModeMeta.color} ${Math.round(pomodoroProgress * 360)}deg, rgba(15,23,42,0.08) 0deg)`,
              boxShadow: 'none',
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(15,23,42,0.06)',
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: pomodoroModeMeta.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {pomodoroModeMeta.label}
                </span>
                <strong style={{
                  marginTop: 8,
                  fontSize: 36,
                  lineHeight: 1,
                  fontWeight: 900,
                  color: '#0f172a',
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  letterSpacing: 0,
                }}>
                  {formatPomodoroTime(pomodoro.remainingSeconds)}
                </strong>
                <span style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                  {Math.round(pomodoroProgress * 100)}% hoàn thành
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 42px', gap: 8 }}>
            <button
              type="button"
              data-no-track="true"
              onClick={togglePomodoro}
              style={{
                height: 44,
                borderRadius: 0,
                border: 'none',
                background: pomodoro.running ? '#0f172a' : pomodoroModeMeta.color,
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {pomodoro.running ? <PauseIcon /> : <Play size={18} fill="currentColor" strokeWidth={0} />}
              {pomodoro.running ? 'Tạm dừng' : 'Bắt đầu'}
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Reset Pomodoro"
              onClick={resetPomodoro}
              style={{
                height: 44,
                borderRadius: 0,
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ResetIcon />
            </button>
            <button
              type="button"
              data-no-track="true"
              aria-label="Chuyển phiên Pomodoro"
              onClick={skipPomodoro}
              style={{
                height: 44,
                borderRadius: 0,
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SkipIcon />
            </button>
          </div>

          <div style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}>
            <div style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 0, padding: '11px 12px', background: '#f8fafc' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Phiên tập trung</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                {pomodoro.completedFocusCount}
              </div>
            </div>
            <div style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 0, padding: '11px 12px', background: '#f8fafc' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Tổng focus</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                {Math.round((pomodoro.completedFocusCount * activePomodoroPreset.focusSeconds) / 60)}p
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
