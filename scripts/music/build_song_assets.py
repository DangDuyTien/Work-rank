#!/usr/bin/env python3
"""
WorkRank — Đua Gõ Theo Nhạc: song catalog + hosted audio builder.

Why this exists
---------------
The music typing race needs *deterministic, licensed* audio. Nothing here is
ripped, streamed or proxied from a third party: every track below is an
original instrumental composed in this file (chords, bass, arpeggio, melody,
percussion) and every lyric is written for WorkRank. The output is therefore
`HOSTED_LICENSED` / `OWNED` audio that can be paused, resumed and ranked.

The same source object produces BOTH the audio and the timed-lyrics JSON, so a
line boundary can never drift from the music: line windows are whole bars of
the same grid the synthesiser renders on.

Run (build-time only, never at runtime):
    /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 \
        scripts/music/build_song_assets.py

Outputs:
    shared/music/songCatalog.json
    frontend/public/audio/music/<song-id>.mp3
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import wave
from datetime import datetime, timezone

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIO_DIR = os.path.join(ROOT, "frontend", "public", "audio", "music")
CATALOG_PATH = os.path.join(ROOT, "shared", "music", "songCatalog.json")
SR = 44100

# ─────────────────────────────────────────────────────────────────────────────
# Harmony
# ─────────────────────────────────────────────────────────────────────────────
CHORDS = {
    "D":  [50, 57, 62, 66],
    "Bm": [47, 54, 59, 62],
    "G":  [43, 50, 55, 59],
    "A":  [45, 52, 57, 61],
    "Am": [45, 52, 57, 60],
    "F":  [41, 48, 53, 57],
    "C":  [48, 55, 60, 64],
    "Em": [40, 47, 52, 55],
}


def midi_to_hz(note: float) -> float:
    return 440.0 * (2.0 ** ((note - 69.0) / 12.0))


# ─────────────────────────────────────────────────────────────────────────────
# Songs — original WorkRank material
# ─────────────────────────────────────────────────────────────────────────────
SONGS = [
    {
        "id": "duong-ve-nha",
        "title": "Đường Về Nhà",
        "artist": "WorkRank Originals",
        "bpm": 96,
        "progression": ["D", "Bm", "G", "A"],
        "introBars": 2,
        "outroBars": 2,
        "barsPerLine": 2,
        "difficulty": "EASY",
        "mood": "Chiều tan làm, phố nhỏ, nhịp vừa phải",
        "arrangement": {"kick": 0.9, "snare": 0.55, "hat": 0.5, "arp": 0.85, "lead": 0.7},
        "lines": [
            "Chiều buông phố",
            "Gió qua hàng cây",
            "Ta qua con đường",
            "Tiếng xe rộn ràng",
            "Nhà ta kia rồi",
            "Đèn lên trước hiên",
            "Mẹ nấu cơm chiều",
            "Thơm mùi canh cá",
            "Ngày dài khép lại",
            "Lòng thấy nhẹ nhàng",
        ],
    },
    {
        "id": "pho-chieu",
        "title": "Phố Chiều",
        "artist": "WorkRank Originals",
        "bpm": 100,
        "progression": ["Am", "F", "C", "G"],
        "introBars": 2,
        "outroBars": 2,
        "barsPerLine": 2,
        "difficulty": "MEDIUM",
        "mood": "Phố đông lúc tan tầm, câu hát quen",
        "arrangement": {"kick": 1.0, "snare": 0.7, "hat": 0.65, "arp": 1.0, "lead": 0.85},
        "lines": [
            "Phố chiều nay đông hơn",
            "Ai cũng vội về nhà",
            "Ta đứng nghe chuông ngân",
            "Tiếng xe qua thật nhanh",
            "Đèn xanh rồi đèn đỏ",
            "Mình đi chậm một chút",
            "Kệ dòng người phía trước",
            "Ta có cả buổi chiều",
            "Nghe nhạc trên phố này",
            "Một bài hát thật quen",
            "Rồi mai ta lại đi",
            "Giữ câu hát trong lòng",
        ],
    },
    {
        "id": "bao-noi",
        "title": "Bão Nổi",
        "artist": "WorkRank Originals",
        "bpm": 120,
        "progression": ["Em", "C", "G", "D"],
        "introBars": 2,
        "outroBars": 2,
        "barsPerLine": 2,
        "difficulty": "HARD",
        "mood": "Mưa lớn, nhịp dồn, thử thách tay nhanh",
        "arrangement": {"kick": 1.15, "snare": 0.85, "hat": 0.8, "arp": 1.1, "lead": 1.0},
        "lines": [
            "Mưa rơi trên phố vắng",
            "Gió thổi qua hàng cây",
            "Ta vẫn đi trong mưa",
            "Chẳng cần ai che chắn",
            "Bão nổi rồi lại tan",
            "Phố sạch sau cơn mưa",
            "Trời trong xanh trở lại",
            "Ta cười với chính mình",
            "Đi qua bao giông tố",
            "Lòng vẫn thấy bình yên",
            "Chuyện hôm qua bỏ lại",
            "Ngày mai lại bắt đầu",
            "Gõ đều từng nhịp thở",
            "Giữ nhịp cho bài ca",
        ],
    },
]

DIFFICULTY_LABEL = {
    "EASY": "DỄ",
    "MEDIUM": "TRUNG BÌNH",
    "HARD": "KHÓ",
    "EXPERT": "SIÊU NHANH",
}


# ─────────────────────────────────────────────────────────────────────────────
# DSP helpers
# ─────────────────────────────────────────────────────────────────────────────
def env_adsr(n: int, attack: float, release: float, sr: int = SR) -> np.ndarray:
    """Linear attack + exponential-ish release, no clicks at either end."""
    a = max(1, int(attack * sr))
    r = max(1, int(release * sr))
    a = min(a, n)
    r = min(r, max(1, n - a))
    env = np.ones(n, dtype=np.float32)
    env[:a] = np.linspace(0.0, 1.0, a, dtype=np.float32)
    tail = np.clip(np.linspace(0.0, 1.0, r, dtype=np.float32), 0.0, 1.0)
    # cos() can dip a hair below zero at the endpoint; a negative base to a
    # fractional power is NaN and would poison the whole buffer.
    env[n - r:] *= np.clip(np.cos(tail * math.pi / 2), 0.0, 1.0) ** 1.5
    return env


def tone(freq: float, dur: float, harmonics=(1.0,), detune=0.0, sr: int = SR) -> np.ndarray:
    n = max(1, int(dur * sr))
    t = np.arange(n, dtype=np.float32) / sr
    f = freq * (1.0 + detune)
    out = np.zeros(n, dtype=np.float32)
    for k, amp in enumerate(harmonics, start=1):
        out += amp * np.sin(2 * math.pi * f * k * t + 0.11 * k).astype(np.float32)
    return out


def add(buf: np.ndarray, start_s: float, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0) -> None:
    """Mix a mono signal into the stereo buffer with equal-power panning."""
    start = int(start_s * SR)
    if start >= buf.shape[0] or start < 0:
        return
    n = min(sig.shape[0], buf.shape[0] - start)
    if n <= 0:
        return
    left = math.cos((pan + 1) * math.pi / 4)
    right = math.sin((pan + 1) * math.pi / 4)
    buf[start:start + n, 0] += sig[:n] * gain * left
    buf[start:start + n, 1] += sig[:n] * gain * right


def kick(dur=0.34) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    freq = 118.0 * np.exp(-t * 26.0) + 44.0
    phase = 2 * math.pi * np.cumsum(freq) / SR
    body = np.sin(phase).astype(np.float32)
    click = (np.random.RandomState(7).randn(n) * 0.06 * np.exp(-t * 160)).astype(np.float32)
    return (body * np.exp(-t * 7.2) + click) * env_adsr(n, 0.002, 0.03)


def snare(dur=0.22, seed=3) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.RandomState(seed)
    noise = rng.randn(n).astype(np.float32)
    noise = np.diff(noise, prepend=noise[0]).astype(np.float32)  # cheap high-pass
    body = np.sin(2 * math.pi * 186 * t).astype(np.float32)
    return (noise * 0.55 + body * 0.35) * np.exp(-t * 22.0) * env_adsr(n, 0.002, 0.02)


def hat(dur=0.07, seed=11) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.RandomState(seed)
    noise = rng.randn(n).astype(np.float32)
    noise = np.diff(noise, prepend=noise[0]).astype(np.float32)
    noise = np.diff(noise, prepend=noise[0]).astype(np.float32)
    return noise * np.exp(-t * 90.0) * env_adsr(n, 0.001, 0.01)


def crash(dur=1.4, seed=21) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.RandomState(seed)
    noise = rng.randn(n).astype(np.float32)
    noise = np.diff(noise, prepend=noise[0]).astype(np.float32)
    return noise * np.exp(-t * 4.2) * env_adsr(n, 0.004, 0.1)


def pad_chord(notes, dur: float) -> np.ndarray:
    n = max(1, int(dur * SR))
    out = np.zeros(n, dtype=np.float32)
    for note in notes:
        f = midi_to_hz(note)
        out += tone(f, dur, (1.0, 0.28, 0.12), detune=-0.0016) * 0.34
        out += tone(f, dur, (1.0, 0.22, 0.08), detune=+0.0018) * 0.34
    return out * env_adsr(n, 0.35, 0.45)


def bass_note(note: int, dur: float) -> np.ndarray:
    n = max(1, int(dur * SR))
    t = np.arange(n, dtype=np.float32) / SR
    f = midi_to_hz(note)
    body = np.sin(2 * math.pi * f * t) + 0.22 * np.sin(2 * math.pi * f * 2 * t)
    env = np.exp(-t * 3.4) * env_adsr(n, 0.006, 0.05)
    return (body * env).astype(np.float32)


def pluck(note: int, dur: float, seed: int) -> np.ndarray:
    n = max(1, int(dur * SR))
    t = np.arange(n, dtype=np.float32) / SR
    f = midi_to_hz(note)
    body = (
        np.sin(2 * math.pi * f * t)
        + 0.32 * np.sin(2 * math.pi * f * 2 * t)
        + 0.14 * np.sin(2 * math.pi * f * 3 * t)
    ).astype(np.float32)
    env = np.exp(-t * 9.0) * env_adsr(n, 0.004, 0.06)
    return body * env


def lead_note(note: int, dur: float) -> np.ndarray:
    n = max(1, int(dur * SR))
    t = np.arange(n, dtype=np.float32) / SR
    f = midi_to_hz(note)
    vib = 1.0 + 0.004 * np.sin(2 * math.pi * 5.2 * t)
    phase = 2 * math.pi * np.cumsum(f * vib) / SR
    body = (np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.07 * np.sin(3 * phase)).astype(np.float32)
    return body * env_adsr(n, 0.045, 0.18) * np.exp(-t * 1.4)


# ─────────────────────────────────────────────────────────────────────────────
# Rendering
# ─────────────────────────────────────────────────────────────────────────────
def render(song) -> tuple[np.ndarray, float, list[dict]]:
    bpm = song["bpm"]
    beat = 60.0 / bpm
    bar = beat * 4
    bars_per_line = song["barsPerLine"]
    lines = song["lines"]
    total_bars = song["introBars"] + bars_per_line * len(lines) + song["outroBars"]
    duration = total_bars * bar
    tail = 1.2
    total_samples = int((duration + tail) * SR)

    buf = np.zeros((total_samples, 2), dtype=np.float32)
    prog = [CHORDS[c] for c in song["progression"]]
    mix = song["arrangement"]
    rng = np.random.RandomState(abs(hash(song["id"])) % (2 ** 31))

    def chord_at(bar_index: int):
        return prog[(bar_index // 2) % len(prog)]

    # ── Pad + bass + arpeggio, one bar at a time ──
    for b in range(total_bars):
        t0 = b * bar
        chord = chord_at(b)
        add(buf, t0, pad_chord(chord, bar * 1.02), 0.20)

        root = chord[0] - 12
        add(buf, t0, bass_note(root, beat * 1.4), 0.55)
        add(buf, t0 + beat * 1.5, bass_note(root, beat * 0.9), 0.34)
        add(buf, t0 + beat * 2, bass_note(root, beat * 1.4), 0.5)
        add(buf, t0 + beat * 3.5, bass_note(root + 7, beat * 0.9), 0.3)

        if b >= 1:
            for step in range(8):
                note = chord[(step + b) % len(chord)] + 12
                add(buf, t0 + step * (beat / 2), pluck(note, beat * 0.62, seed=b * 8 + step),
                    mix["arp"] * (0.16 if step % 2 else 0.22), pan=0.22 if step % 2 else -0.18)

        # Percussion
        if b >= song["introBars"] - 1:
            add(buf, t0, kick(), 0.30 * mix["kick"], pan=0.0)
            add(buf, t0 + beat * 2, kick(), 0.26 * mix["kick"], pan=0.0)
            if bpm >= 110:
                add(buf, t0 + beat * 1.5, kick(), 0.18 * mix["kick"])
                add(buf, t0 + beat * 3.5, kick(), 0.14 * mix["kick"])
            add(buf, t0 + beat, snare(), 0.14 * mix["snare"], pan=0.06)
            add(buf, t0 + beat * 3, snare(), 0.15 * mix["snare"], pan=-0.06)
            for step in range(8):
                add(buf, t0 + step * (beat / 2), hat(seed=b * 8 + step),
                    0.055 * mix["hat"] * (1.0 if step % 2 == 0 else 0.7), pan=0.3 if step % 2 else -0.3)

    # ── Lead melody: a short motif per line, so each phrase has a hook ──
    motif = [0, 2, 4, 2, 0, -2, 0, 4]
    for i, _ in enumerate(lines):
        line_start_bar = song["introBars"] + i * bars_per_line
        chord = chord_at(line_start_bar)
        base = chord[1] + 12
        t0 = line_start_bar * bar
        for step in range(8):
            if step in (3, 7) and i % 2 == 1:
                continue
            note = base + motif[(step + i) % len(motif)]
            add(buf, t0 + step * (beat / 2), lead_note(note, beat * 0.55),
                mix["lead"] * (0.085 if step % 2 == 0 else 0.065), pan=0.1)

    # ── Section punctuation: crash on intro end, every 4 lines, and outro ──
    add(buf, song["introBars"] * bar, crash(), 0.16, pan=-0.15)
    for i in range(4, len(lines), 4):
        add(buf, (song["introBars"] + i * bars_per_line) * bar, crash(), 0.12, pan=0.18)
    add(buf, (song["introBars"] + len(lines) * bars_per_line) * bar, crash(), 0.18, pan=0.0)

    # ── Normalise + soft clip ──
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.92
    buf = np.tanh(buf * 1.08).astype(np.float32) * 0.95
    return buf, duration, build_lines(song, bar)


def build_lines(song, bar: float) -> list[dict]:
    lines = []
    for i, text in enumerate(song["lines"]):
        start = (song["introBars"] + i * song["barsPerLine"]) * bar
        end = start + song["barsPerLine"] * bar
        lines.append({
            "id": f"l{i + 1}",
            "index": i,
            "startMs": int(round(start * 1000)),
            "endMs": int(round(end * 1000)),
            "text": text,
        })
    # Contiguity is part of the contract: the gate sits exactly where the next line starts.
    for a, b in zip(lines, lines[1:]):
        assert a["endMs"] == b["startMs"], "line windows must be contiguous"
    return lines


def write_wav(buf: np.ndarray, path: str) -> None:
    pcm = np.clip(buf, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(path, "wb") as fh:
        fh.setnchannels(2)
        fh.setsampwidth(2)
        fh.setframerate(SR)
        fh.writeframes(pcm.tobytes())


def encode_mp3(wav_path: str, mp3_path: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", wav_path,
            "-af", "aecho=0.8:0.82:64|124:0.18|0.10,alimiter=limit=0.95",
            "-codec:a", "libmp3lame", "-b:a", "160k", "-ar", "44100",
            mp3_path,
        ],
        check=True,
    )


def probe_duration_ms(path: str) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return int(round(float(out) * 1000))


def analyse(lines: list[dict]) -> dict:
    texts = [ln["text"] for ln in lines]
    char_counts = [len(t) for t in texts]
    spans = [(ln["endMs"] - ln["startMs"]) / 1000.0 for ln in lines]
    cps = [c / s for c, s in zip(char_counts, spans)]
    accented = 0
    total = 0
    for t in texts:
        for ch in unicodedata.normalize("NFC", t):
            if ch.isspace():
                continue
            total += 1
            if unicodedata.combining(ch) or unicodedata.normalize("NFD", ch) != ch:
                accented += 1
    return {
        "charCount": sum(char_counts),
        "charsPerSecond": round(float(np.mean(cps)), 2),
        "peakCharsPerSecond": round(float(np.max(cps)), 2),
        "accentRatio": round(accented / max(1, total), 3),
        "avgLineChars": round(float(np.mean(char_counts)), 1),
        "lineCount": len(lines),
    }


def classify(metrics: dict) -> str:
    """Sanity check on the authored label — never the source of truth."""
    cps = metrics["charsPerSecond"]
    if cps < 3.4:
        return "EASY"
    if cps < 4.5:
        return "MEDIUM"
    if cps < 5.6:
        return "HARD"
    return "EXPERT"


def main() -> int:
    if shutil.which("ffmpeg") is None:
        print("ffmpeg is required to encode the hosted tracks.", file=sys.stderr)
        return 1
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CATALOG_PATH), exist_ok=True)

    catalog = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "licence": "WorkRank Original — composed, performed and produced in-house. No third-party audio or lyrics.",
        "songs": [],
    }

    with tempfile.TemporaryDirectory() as tmp:
        for song in SONGS:
            print(f"→ rendering {song['id']} …")
            buf, composed_duration, lines = render(song)
            wav_path = os.path.join(tmp, f"{song['id']}.wav")
            mp3_path = os.path.join(AUDIO_DIR, f"{song['id']}.mp3")
            write_wav(buf, wav_path)
            encode_mp3(wav_path, mp3_path)
            duration_ms = probe_duration_ms(mp3_path)
            metrics = analyse(lines)
            computed = classify(metrics)
            if computed != song["difficulty"]:
                print(f"   ! difficulty drift: authored {song['difficulty']} / measured {computed} "
                      f"({metrics['charsPerSecond']} c/s)")
            catalog["songs"].append({
                "id": song["id"],
                "title": song["title"],
                "artist": song["artist"],
                "language": "VI",
                "bpm": song["bpm"],
                "difficulty": song["difficulty"],
                "difficultyLabel": DIFFICULTY_LABEL[song["difficulty"]],
                "mood": song["mood"],
                "durationMs": duration_ms,
                "composedDurationMs": int(round(composed_duration * 1000)),
                "timedLyricsVersion": 1,
                "audioSource": {
                    "type": "HOSTED_LICENSED",
                    "assetKey": f"music/{song['id']}",
                    "url": f"/audio/music/{song['id']}.mp3",
                    "rightsStatus": "OWNED",
                    "licence": "WorkRank Original — composed and produced in-house for this game.",
                    "attribution": "WorkRank Originals",
                },
                "lyricsSource": {
                    "type": "ORIGINAL",
                    "rightsStatus": "OWNED",
                    "author": "WorkRank",
                    "licence": "Original lyrics written for WorkRank. No third-party lyric text.",
                },
                "lines": lines,
                "metrics": metrics,
            })
            print(f"   ✓ {duration_ms} ms · {metrics['charsPerSecond']} c/s · {metrics['lineCount']} lines")

    with open(CATALOG_PATH, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"✓ wrote {CATALOG_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
