import React, { memo, useMemo } from 'react';
import { graphemes, sameCharacter } from '../../utils/typingText';
import { AUDIO_STATE, LINE_STATE } from '../../games/music/engine';

/**
 * Karaoke lyric column: previous line (ghost), current line (the only thing
 * that matters), next line (preview). Characters carry their own state so a
 * single wrong grapheme is visible without colouring the whole line.
 */
function LyricLine({ text, typed, muted = false, tone = 'current', complete = false }) {
  const chars = useMemo(() => graphemes(text), [text]);
  const typedChars = useMemo(() => graphemes(typed || ''), [typed]);
  return (
    <p className={`music-lyric music-lyric--${tone}`} data-complete={complete ? 'true' : 'false'}>
      {complete && <span className="music-lyric-tick" aria-hidden="true">✓</span>}
      {chars.map((char, index) => {
        if (muted) {
          return <span key={index} className="music-glyph is-ghost">{char}</span>;
        }
        const state = index < typedChars.length
          ? (sameCharacter(typedChars[index], char) ? 'correct' : 'wrong')
          : index === typedChars.length ? 'current' : 'remaining';
        return (
          <span key={index} className={`music-glyph is-${state}`} data-state={state}>
            {char}
            {state === 'current' && <i className="music-caret" aria-hidden="true" />}
          </span>
        );
      })}
    </p>
  );
}

function LyricKaraoke({ lines, lineIndex, typedValue, audioState, lineState }) {
  const previous = lineIndex > 0 ? lines[lineIndex - 1] : null;
  const current = lines[lineIndex] || null;
  const next = lineIndex + 1 < lines.length ? lines[lineIndex + 1] : null;
  const paused = audioState === AUDIO_STATE.WAITING_AT_BOUNDARY;
  const ready = lineState === LINE_STATE.COMPLETED || audioState === AUDIO_STATE.LINE_READY;
  const finished = audioState === AUDIO_STATE.FINISHED;

  return (
    <section className="music-lyrics" data-paused={paused} data-ready={ready} aria-live="polite">
      <p className="music-lyric-ghost" aria-hidden="true">
        {previous ? previous.text : '♫'}
      </p>

      <div className="music-lyric-current" aria-label={current ? `Câu đang hát: ${current.text}` : 'Bài hát đã kết thúc'}>
        {current ? (
          <LyricLine text={current.text} typed={typedValue} complete={ready} tone="current" />
        ) : (
          <p className="music-lyric music-lyric--current">♫ Hết bài</p>
        )}
      </div>

      <p className="music-lyric-ghost music-lyric-ghost--next" aria-hidden="true">
        {next ? next.text : finished ? '♫' : '— hết câu cuối —'}
      </p>

      {paused && (
        <div className="music-pause-call" role="status">
          <b>HOÀN THÀNH CÂU ĐỂ NHẠC CHẠY TIẾP</b>
          <span>Nhạc đã dừng đúng cuối câu · sửa phần còn thiếu rồi gõ tiếp</span>
        </div>
      )}
      {!paused && ready && audioState !== AUDIO_STATE.FINISHED && (
        <p className="music-ready-call" role="status">✓ ĐÃ THEO KỊP · sẵn sàng câu tiếp</p>
      )}
    </section>
  );
}

export default memo(LyricKaraoke);
