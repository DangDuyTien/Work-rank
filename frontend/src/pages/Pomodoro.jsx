import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTracking } from '../context/TrackingContext';
import { getAppSettings, saveAppSettings, subscribeAppSettings } from '../utils/settings';
import { playPomodoroChime, requestNotificationPermission, sendBrowserNotification, vibrateDevice, openPipWindow, closePipWindow, isPipOpen } from '../utils/notifications';
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
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: 32,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <style>{`
        @keyframes pm-colon-blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes pm-glow { 0%,100%{box-shadow:0 0 0 rgba(6,182,212,0)} 50%{box-shadow:0 0 20px rgba(6,182,212,0.25)} }
        @keyframes pm-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes pm-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes pm-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .pm-btn:hover{filter:brightness(1.3)!important;transform:translateY(-1px)!important}
        .pm-btn:active{transform:translateY(0)!important;filter:brightness(0.95)!important}
        .pm-tile-urgent .pm-digit{color:#ef4444!important}
        .pm-tile-urgent .pm-tile-inner{box-shadow:0 0 20px rgba(239,68,68,0.35)!important;border-color:rgba(239,68,68,0.5)!important}
        .pm-settings-enter{animation:pm-fade-in 0.2s ease forwards}
      `}</style>

      <section style={{
        width: 400,
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
              onClick={() => { if (isPipOpen()) closePipWindow(); else openPipWindow(); }}
              className="pm-btn"
              style={{
                height: 26,
                padding: '0 7px',
                border: isPipOpen()
                  ? `1px solid ${pomodoroModeMeta.color}`
                  : '1px solid rgba(255,255,255,0.1)',
                background: isPipOpen() ? pomodoroModeMeta.bg : 'rgba(255,255,255,0.04)',
                color: isPipOpen() ? pomodoroModeMeta.color : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s ease',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              {isPipOpen() ? 'Ẩn' : 'Nổi'}
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
  );
}
