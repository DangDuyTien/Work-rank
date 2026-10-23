import React, { memo } from 'react';
import { AUDIO_STATE } from '../../games/music/engine';

/**
 * The 2D room the song happens in — a compact stage band, not a hero image.
 *
 * It is deliberately short: the lyric is the game, the room is the atmosphere.
 * Pure decoration on purpose, so a 90ms gate tick never re-renders the lyric
 * line. Motion is CSS only and every animation stops when the music stops.
 */
function MusicStage({ state, flowPct = 100, streak = 0, racers = [], showRacers = false }) {
  const playing = state === AUDIO_STATE.PLAYING_LINE || state === AUDIO_STATE.LINE_READY || state === AUDIO_STATE.RESUMING;
  const waiting = state === AUDIO_STATE.WAITING_AT_BOUNDARY;
  const resuming = state === AUDIO_STATE.RESUMING;
  const mood = waiting ? 'waiting' : resuming ? 'resuming' : playing ? 'singing' : 'idle';
  const floor = 104;

  return (
    <div className="music-stage" data-playing={playing} data-mood={mood} aria-hidden="true">
      <svg className="music-stage-svg" viewBox="0 0 680 150" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">
        <defs>
          <linearGradient id="music-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbf6ea" />
            <stop offset="100%" stopColor="#f1e6d2" />
          </linearGradient>
          <linearGradient id="music-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8d9be" />
            <stop offset="100%" stopColor="#dcc9a8" />
          </linearGradient>
          <radialGradient id="music-spot" cx="50%" cy="0%" r="72%">
            <stop offset="0%" stopColor="#fff9e9" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff9e9" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="music-rail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#8a3f12" />
          </linearGradient>
        </defs>

        {/* Room */}
        <rect x="0" y="0" width="680" height="150" fill="url(#music-wall)" />
        <ellipse cx="340" cy="-24" rx="236" ry="130" fill="url(#music-spot)" />
        <path d={`M0 ${floor} H680 V150 H0 Z`} fill="url(#music-floor)" />
        <path d={`M0 ${floor} H680`} stroke="#cbb491" strokeWidth="1.2" />
        <path d={`M64 ${floor} h552 l12 7 H52 Z`} fill="#d9c5a3" opacity="0.65" />

        {/* Speakers */}
        <g className="music-speaker" data-side="left">
          <rect x="52" y="64" width="34" height="40" rx="5" fill="#2b2a26" />
          <circle cx="69" cy="76" r="7" fill="#4b4842" />
          <circle cx="69" cy="94" r="9" fill="#3a3833" />
          <circle cx="69" cy="94" r="3.5" fill="#211f1c" />
        </g>
        <g className="music-speaker" data-side="right">
          <rect x="594" y="64" width="34" height="40" rx="5" fill="#2b2a26" />
          <circle cx="611" cy="76" r="7" fill="#4b4842" />
          <circle cx="611" cy="94" r="9" fill="#3a3833" />
          <circle cx="611" cy="94" r="3.5" fill="#211f1c" />
        </g>

        {/* Equalizer: stops dead when the music stops */}
        <g className="music-eq">
          {Array.from({ length: 24 }, (_, i) => {
            const x = 106 + i * 19.6;
            const top = 62 + ((i * 37) % 9) * 3.4;
            return (
              <rect
                key={i}
                x={x}
                y={top}
                width="6"
                height={Math.max(5, floor - top)}
                rx="3"
                fill="#b45309"
                opacity={0.16 + (i % 3) * 0.06}
                className="music-eq-bar"
                style={{ animationDelay: `${(i % 7) * 90}ms`, transformOrigin: `${x + 3}px ${floor}px` }}
              />
            );
          })}
        </g>

        {/* Singer */}
        <g className="music-singer">
          <ellipse cx="340" cy="107" rx="28" ry="4.5" fill="#c3ab86" opacity="0.5" />
          <path d="M325 102 q15 -9 30 0 l-3 5 h-24 Z" fill="#8a5a2b" />
          <path d="M330 72 q10 -6 20 0 l5 30 q-15 6 -30 0 Z" fill="#38506f" />
          <path d="M330 72 q10 -6 20 0 l-1.5 8 q-8.5 -3.5 -17 0 Z" fill="#2b3f58" />
          <circle cx="340" cy="58" r="12.5" fill="#f0c9a3" />
          <path d="M327.5 55 q12.5 -15 25 0 q-5 -3 -12.5 -3 t-12.5 3 Z" fill="#2b2a26" />
          <circle cx="335.5" cy="58.5" r="1.4" fill="#2b2a26" />
          <circle cx="344.5" cy="58.5" r="1.4" fill="#2b2a26" />
          <path d="M336.5 63.5 q3.5 3 7 0" stroke="#a4552f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <g className="music-mic-arm">
            <path d="M348 78 q14 2 17 -9" stroke="#f0c9a3" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <rect x="362" y="58" width="7" height="14" rx="3.5" fill="#2b2a26" />
            <circle cx="365.5" cy="58" r="4.2" fill="#57534b" />
          </g>
        </g>

        {/* Audience */}
        <g className="music-audience" opacity="0.42">
          {[74, 128, 182, 232, 452, 502, 556, 610].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={122 + (i % 2) * 3} r="6.5" fill="#8a775c" />
              <path d={`M${x - 11} 146 q11 -16 22 0 Z`} fill="#8a775c" />
            </g>
          ))}
        </g>

        {/* Waiting bubble */}
        {waiting && (
          <g className="music-pause-flag">
            <rect x="304" y="10" width="72" height="24" rx="12" fill="#ffffff" stroke="#d9c9ab" />
            <rect x="330" y="17" width="4" height="10" rx="2" fill="#b45309" />
            <rect x="341" y="17" width="4" height="10" rx="2" fill="#b45309" />
            <text x="354" y="26" fontSize="10" fill="#7a5c39" fontWeight="700">chờ</text>
          </g>
        )}

        {/* Flow rail: the song's continuity as a stage edge light */}
        <g className="music-flow-rail">
          <rect x="0" y="145" width="680" height="5" fill="#e2d3b8" />
          <rect x="0" y="145" width={Math.max(0, Math.min(680, (flowPct / 100) * 680))} height="5" fill="url(#music-rail)" />
        </g>

        {/* Multiplayer race rail: avatars move by lyric progress, not audio time */}
        {showRacers && racers.length > 0 && (
          <g className="music-racers">
            {racers.map((racer, index) => {
              const left = 26 + (Math.max(0, Math.min(100, racer.progressPct || 0)) / 100) * 628;
              const y = 26 + index * 17;
              return (
                <g key={racer.userId || racer.name || index} transform={`translate(${left} ${y})`}>
                  <circle r="7" fill={racer.color || '#38506f'} />
                  <text x="0" y="3" textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight="700">
                    {String(racer.name || '?').slice(0, 1).toUpperCase()}
                  </text>
                  <text x="11" y="3" fontSize="8" fill="#6b573c">{racer.name}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {streak >= 3 && (
        <span className="music-streak-chip" key={streak}>GIỮ NHỊP TỐT · x{streak}</span>
      )}
    </div>
  );
}

export default memo(MusicStage);
