/**
 * Core rule under test: a typo never cuts the music mid-line.
 * The audio only stops on a line boundary, and only while that line is unfinished.
 *
 * Run: npm --prefix frontend run test:music
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMusicRaceEngine, AUDIO_STATE, LINE_STATE, flowPercent, computeMusicScore } from '../src/games/music/engine.js';

const SONG = {
  id: 'test-song',
  timedLyricsVersion: 1,
  lines: [
    { id: 'l1', startMs: 0, endMs: 4000, text: 'Ngày hôm nay trời xanh' },
    { id: 'l2', startMs: 4000, endMs: 8000, text: 'Gió nhẹ qua hàng cây' },
    { id: 'l3', startMs: 8000, endMs: 12000, text: 'Ta đi trên phố dài' },
    { id: 'l4', startMs: 12000, endMs: 16000, text: 'Lòng thấy thật bình yên' },
  ],
  durationMs: 18000,
};

function fakeAdapter({ durationMs = SONG.durationMs } = {}) {
  let time = 0;
  let playing = false;
  let buffering = false;
  let ended = false;
  const calls = { play: 0, pause: 0, seek: [], load: 0 };
  return {
    calls,
    load: async () => { calls.load += 1; },
    play() { playing = true; calls.play += 1; },
    pause() { playing = false; calls.pause += 1; },
    seek(ms) { time = ms; calls.seek.push(ms); },
    getCurrentTime: () => time,
    getDuration: () => durationMs,
    isBuffering: () => buffering,
    hasEnded: () => ended,
    // test controls
    advance(ms) {
      if (playing) time = Math.min(durationMs, time + ms);
      if (time >= durationMs) ended = true;
      return time;
    },
    setBuffering(value) { buffering = value; },
    get playing() { return playing; },
    get time() { return time; },
  };
}

async function makeEngine(options = {}) {
  const adapter = fakeAdapter(options.adapter);
  const events = [];
  const engine = createMusicRaceEngine({
    song: SONG,
    adapter,
    onEvent: (event) => events.push(event),
    resumeSettleMs: 0,
  });
  await engine.prepare();
  return { engine, adapter, events };
}

const type = (engine, text) => engine.applyInput(text);

test('loads and starts on an explicit user gesture', async () => {
  const { engine, adapter } = await makeEngine();
  assert.equal(engine.getState(), AUDIO_STATE.PREPARING);
  assert.equal(adapter.calls.load, 1);
  engine.start();
  assert.equal(engine.getState(), AUDIO_STATE.PLAYING_LINE);
  assert.equal(adapter.playing, true);
});

test('does not pause mid-line on a wrong character', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời xah'); // typo in the last word
  adapter.advance(2000);
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 0, 'a typo must never cut the audio');
  assert.equal(engine.getState(), AUDIO_STATE.PLAYING_LINE);
  assert.equal(adapter.playing, true);
});

test('pauses exactly at the line boundary when the line is unfinished', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời');
  adapter.advance(3900);
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 0, 'still inside the line');

  adapter.advance(150); // crosses 4000ms
  const state = engine.tick(adapter.getCurrentTime());
  assert.equal(state, AUDIO_STATE.WAITING_AT_BOUNDARY);
  assert.equal(adapter.calls.pause, 1);
  assert.equal(adapter.playing, false);
  assert.ok(Math.abs(adapter.time - 4000) <= 320, `snapped to boundary, got ${adapter.time}`);
  assert.equal(engine.getSnapshot().pauseCount, 1);
  assert.equal(engine.getSnapshot().lineState, LINE_STATE.WAITING_CORRECTION);
});

test('advances without pausing when the line was completed before the boundary', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời xanh');
  assert.equal(engine.getState(), AUDIO_STATE.LINE_READY);

  adapter.advance(4100);
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 0);
  assert.equal(engine.getState(), AUDIO_STATE.PLAYING_LINE);
  assert.equal(engine.getLineIndex(), 1);
  assert.equal(engine.getSnapshot().lineState, LINE_STATE.ACTIVE);
  assert.equal(engine.getSnapshot().noPauseStreak, 1);
});

test('completing the line at the boundary resumes exactly once', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay');
  adapter.advance(4200);
  engine.tick(adapter.getCurrentTime());
  assert.equal(engine.getState(), AUDIO_STATE.WAITING_AT_BOUNDARY);
  const playsBefore = adapter.calls.play;

  type(engine, 'Ngày hôm nay trời xanh');
  assert.equal(adapter.calls.play, playsBefore + 1, 'resume once');
  assert.equal(engine.getLineIndex(), 1);

  // Duplicate delivery: compositionend + input + socket update in one tick.
  type(engine, 'Ngày hôm nay trời xanh');
  type(engine, 'Ngày hôm nay trời xanh');
  assert.equal(adapter.calls.play, playsBefore + 1, 'no duplicate play()');
});

test('a line completed exactly at the boundary does not pause', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời xanh');
  adapter.advance(4000); // lands exactly on endMs
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 0);
  assert.equal(engine.getLineIndex(), 1);
});

test('backspacing a completed line makes the boundary gate real again', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời xanh');
  assert.equal(engine.getState(), AUDIO_STATE.LINE_READY);
  type(engine, 'Ngày hôm nay trời xan');
  assert.equal(engine.getState(), AUDIO_STATE.PLAYING_LINE);

  adapter.advance(4100);
  engine.tick(adapter.getCurrentTime());
  assert.equal(engine.getState(), AUDIO_STATE.WAITING_AT_BOUNDARY);
  assert.equal(adapter.calls.pause, 1);
});

test('Vietnamese: accents are required, case is not', async () => {
  const { engine } = await makeEngine();
  engine.start();
  type(engine, 'ngay hom nay troi xanh');
  assert.notEqual(engine.getState(), AUDIO_STATE.LINE_READY, 'unaccented text must not match');

  type(engine, 'NGÀY HÔM NAY TRỜI XANH');
  assert.equal(engine.getState(), AUDIO_STATE.LINE_READY, 'case-insensitive, accent-sensitive');
});

test('Vietnamese: NFD input is normalised to NFC before comparing', async () => {
  const { engine } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay trời xanh'.normalize('NFD'));
  assert.equal(engine.getState(), AUDIO_STATE.LINE_READY);
});

test('buffering is not the player’s fault', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm');
  adapter.advance(4000);
  adapter.setBuffering(true);
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 0, 'never pause while the network stalls');
  assert.equal(engine.getSnapshot().pauseCount, 0);

  adapter.setBuffering(false);
  engine.tick(adapter.getCurrentTime());
  assert.equal(adapter.calls.pause, 1, 'the gate resumes once audio is back');
});

test('finishes the song with 100% flow when nothing ever stopped', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  const texts = SONG.lines.map((line) => line.text);
  for (let i = 0; i < texts.length; i += 1) {
    type(engine, texts[i]);
    adapter.advance(4000);
    engine.tick(adapter.getCurrentTime());
  }
  adapter.advance(3000);
  engine.tick(adapter.getCurrentTime());
  const snap = engine.getSnapshot();
  assert.equal(snap.state, AUDIO_STATE.FINISHED);
  assert.equal(snap.pauseCount, 0);
  assert.equal(snap.flowPct, 100);
  assert.equal(snap.completedLines, 4);
  assert.equal(snap.bestNoPauseStreak, 4);
  assert.equal(snap.accuracy, 100);
});

test('flow drops by exactly one boundary per stop', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay');
  adapter.advance(4100);
  engine.tick(adapter.getCurrentTime());   // stop #1 at 4000
  type(engine, SONG.lines[0].text);        // corrected → resume at 4000

  type(engine, SONG.lines[1].text);
  adapter.advance(4000);
  engine.tick(adapter.getCurrentTime());   // clean boundary at 8000

  type(engine, 'Ta đi trên');
  adapter.advance(4000);
  engine.tick(adapter.getCurrentTime());   // stop #2 at 12000

  const snap = engine.getSnapshot();
  assert.equal(snap.pauseCount, 2);
  assert.equal(snap.flowPct, 50);
  assert.equal(flowPercent(4, 1), 75);
});

test('evidence is complete enough for a server to re-score', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm nay');
  adapter.advance(4100);
  engine.tick(adapter.getCurrentTime());
  type(engine, 'Ngày hôm nay trời xanh');

  const evidence = engine.getEvidence();
  assert.equal(evidence.songId, 'test-song');
  assert.equal(evidence.totalLines, 4);
  assert.equal(evidence.linesCompleted, 1);
  assert.equal(evidence.pauseCount, 1);
  assert.equal(evidence.pauses.length, 1);
  assert.equal(evidence.pauses[0].lineIndex, 0);
  assert.ok(evidence.pauses[0].durationMs >= 0);
  assert.ok(Number.isFinite(evidence.score));
});

test('score rewards flow and accuracy, not raw speed', () => {
  const perfect = computeMusicScore({ accuracy: 100, completedLines: 10, totalLines: 10, flowPct: 100, bestNoPauseStreak: 10 });
  const stopped = computeMusicScore({ accuracy: 100, completedLines: 10, totalLines: 10, flowPct: 60, bestNoPauseStreak: 3 });
  const sloppy = computeMusicScore({ accuracy: 80, completedLines: 10, totalLines: 10, flowPct: 100, bestNoPauseStreak: 10 });
  assert.ok(perfect > stopped);
  assert.ok(perfect > sloppy);
});

test('tab hidden after finishing a line moves to the next line before pausing', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, SONG.lines[0].text);
  assert.equal(engine.getState(), AUDIO_STATE.LINE_READY);
  adapter.advance(1200);

  assert.equal(engine.pauseForVisibility(), true);
  assert.equal(adapter.playing, false);
  assert.equal(engine.getLineIndex(), 1, 'playhead moved to the next line');
  assert.equal(engine.getSnapshot().lineState, LINE_STATE.WAITING_CORRECTION);
  assert.equal(engine.getSnapshot().pauseCount, 1);

  // Returning and typing the new line resumes exactly once.
  const playsBefore = adapter.calls.play;
  type(engine, SONG.lines[1].text);
  assert.equal(adapter.calls.play, playsBefore + 1);
});

test('tab hidden pauses the run and counts as a stop', async () => {
  const { engine, adapter } = await makeEngine();
  engine.start();
  type(engine, 'Ngày hôm');
  adapter.advance(1000);
  assert.equal(engine.pauseForVisibility(), true);
  assert.equal(adapter.playing, false);
  assert.equal(engine.getSnapshot().pauseCount, 1);
});
