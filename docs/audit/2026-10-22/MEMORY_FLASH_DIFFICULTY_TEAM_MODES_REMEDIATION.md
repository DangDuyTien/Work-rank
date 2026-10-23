# Memory Flash — difficulty ramp + team modes remediation

Date: 2026-10-22
Scope: `workrank-realtime` — Memory Flash gameplay, shared Arcade room engine, 1V1/2V2/3V3 team modes.
Out of scope: Typing Battle legacy room engine (unchanged).

---

## Executive summary

Memory Flash was not hard because the grid stayed at 3×3. It was hard to lose because:

1. the answer window was **12 seconds** — effectively unlimited;
2. a 60-second run only reached **level 5–6**, so the strongest part of the old curve (level 12) was unreachable;
3. the pattern family was chosen by `index % 5`, making the sequence predictable;
4. the easiest families (full line, four corners, L-shape) were guaranteed to appear every five rounds;
5. there was no pattern-difficulty heuristic, so a high level could receive a low-level pattern;
6. there was no endgame stage — the last ten seconds looked exactly like the first ten.

The new rules v3 make difficulty a function of **grid size + target count + reveal time + answer window + transition speed + pattern complexity**, all reachable inside 60 seconds, with a deterministic `MEMORY RUSH` tier from level 9.

Multiplayer was also incomplete. The Arcade room engine only ever had `SOLO`, `DUO` and `TRIO`. `DUO` was labelled “Đấu 1v1” in the UI but its id was `DUO`; `TRIO` was three players free-for-all. There was **no 2V2 and no 3V3** in the Arcade engine — not a removed feature, but a capability the new engine never had (the legacy Typing engine did have those enums). This remediation adds `1V1` (2 players), `2V2` (4 players, 2+2) and `3V3` (6 players, 3+3) on the **same** shared room engine, with server-authoritative team assignment, team scoring, team results and one reward per player.

---

## Why Memory Was Too Easy

### 1. The answer window removed all pressure

`selectMs` was `12000` for every level below 13 and `9000` above. A typical correct answer takes 0.8–2.0s. The timer existed in the UI but never influenced play. A player could look away, reconstruct the pattern verbally, and still answer.

### 2. The top of the curve was unreachable

`level = floor(index / 3) + 1`. In 60 seconds the old pacing fits 15–17 rounds (≈ 3.5–4.0s per round), so the run ends at **level 5–6**:

- level 6 = 4×4, 5 targets, 1.7s reveal, 12s answer.

Level 12 (5×5, 8 targets, 1.2s reveal) needed round 34, roughly 120 seconds. The part of the curve that was supposed to be hard was never played.

### 3. Pattern family was predictable

The generator used `kind = ['scattered','line','corners','shape','asymmetric'][index % 5]`. A player who noticed the cycle knew that round 3, 8, 13… would be corners. That converts memory into pattern prediction.

### 4. The easy families were guaranteed, not occasional

- `line`: a contiguous segment of one row/column — encodable as “row 2, first three”.
- `corners`: all four corners — encodable in one sentence.
- `shape`: an L triomino — encodable as a shape.

They appeared on a fixed 3-in-5 cadence (60% of rounds).

### 5. No pattern-difficulty heuristic

RNG could hand a level-11 round a pattern that was easier than a level-3 round. There was no floor and no rejection sampling.

### 6. Feedback and transitions were constant

Wrong-answer feedback was always 800ms and correct feedback 320ms, at level 1 and at level 12. Transitions (`prepareMs` 250, `hideMs` 150, `restMs` 320/800) never accelerated, so the game never *felt* faster even when the grid grew.

---

## Old Difficulty Curve

Rules v2 (`level = floor(index / 3) + 1`, `selectMs` 12s below level 13):

| Level | Rounds | Grid | Targets | Reveal | Answer | Prepare / Hide / Rest |
|---|---|---|---|---|---|---|
| 1 | 1–3 | 3×3 | 2 | 2000ms | 12000ms | 250 / 150 / 320 |
| 2 | 4–6 | 3×3 | 3 | 2000ms | 12000ms | 250 / 150 / 320 |
| 3 | 7–9 | 4×4 | 3 | 2000ms | 12000ms | 250 / 150 / 320 |
| 4 | 10–12 | 4×4 | 3 | 1700ms | 12000ms | 250 / 150 / 320 |
| 5 | 13–15 | 4×4 | 4 | 1700ms | 12000ms | 250 / 150 / 320 |
| 6 | 16–18 | 4×4 | 5 | 1700ms | 12000ms | 250 / 150 / 320 |
| 7 | 19–21 | 5×5 | 5 | 1700ms | 12000ms | 250 / 150 / 320 |
| 8 | 22–24 | 5×5 | 5 | 1400ms | 12000ms | 250 / 150 / 320 |
| 9 | 25–27 | 5×5 | 6 | 1400ms | 12000ms | 250 / 150 / 320 |
| 10 | 28–30 | 5×5 | 7 | 1400ms | 12000ms | 250 / 150 / 320 |
| 11 | 31–33 | 5×5 | 8 | 1400ms | 12000ms | 250 / 150 / 320 |
| 12 | 34–36 | 5×5 | 8 | 1200ms | 12000ms | 250 / 150 / 320 |
| 13+ | 37+ | 5×5 | 8 | 1200ms | 9000ms | 250 / 150 / 320 |

A 60-second run fits roughly 15–17 rounds at the old pacing, i.e. **level 5–6**. Everything from level 7 upward was dead content.

---

## New Difficulty Curve

Rules v3: `level = floor(index / 2) + 1`, capped at 14. Two rounds per level so the whole ladder fits in a 60-second match. Max grid is 5×5 (see Mobile).

| Level | Stage | Grid | Targets | Reveal | Answer | Prepare / Hide / Rest |
|---|---|---|---|---|---|---|
| 1 | EASY | 3×3 | 2 | 2000ms | 5000ms | 320 / 150 / 420 |
| 2 | EASY | 3×3 | 3 | 1850ms | 4800ms | 310 / 145 / 400 |
| 3 | EASY | 3×3 | 3 | 1700ms | 4600ms | 300 / 140 / 380 |
| 4 | MEDIUM | 4×4 | 4 | 1500ms | 4300ms | 290 / 135 / 360 |
| 5 | MEDIUM | 4×4 | 5 | 1380ms | 4000ms | 280 / 130 / 340 |
| 6 | MEDIUM | 4×4 | 6 | 1260ms | 3800ms | 270 / 125 / 320 |
| 7 | HARD | 5×5 | 6 | 1140ms | 3500ms | 260 / 120 / 300 |
| 8 | HARD | 5×5 | 7 | 1030ms | 3200ms | 250 / 118 / 285 |
| 9 | RUSH | 5×5 | 8 | 930ms | 2900ms | 240 / 115 / 270 |
| 10 | RUSH | 5×5 | 9 | 850ms | 2600ms | 230 / 112 / 255 |
| 11 | RUSH | 5×5 | 9 | 800ms | 2450ms | 220 / 110 / 245 |
| 12 | RUSH | 5×5 | 10 | 770ms | 2350ms | 210 / 108 / 235 |
| 13 | RUSH | 5×5 | 10 | 740ms | 2250ms | 200 / 105 / 225 |
| 14 | RUSH | 5×5 | 11 | 720ms | 2150ms | 190 / 100 / 215 |

Every pressure axis is monotonic non-decreasing (grid, targets) or strictly decreasing (reveal, answer, prepare, hide, rest). The curve is asserted in `arcade_engine.test.js`.

### Reachability

`simulateMemoryRun()` (average response 1.4s − 40ms/level) fits **17 rounds** in 60s and reaches **level 9 / RUSH** at 57.7s. A fast player reaches RUSH around 40–45s and continues through levels 10–14. A slower player still reaches HARD. The strongest tier is no longer dead content.

---

## Reveal Timing

- The reveal meter starts at the exact first frame the tiles are visible: `revealStart = previousAt + restMs + prepareMs`, which is also the `FLASH` phase boundary.
- The lit/unlit transition is disabled for `phase-flash` and `phase-hide` (`transition: none`), so no entrance animation consumes reveal time.
- The meter is labelled `GHI NHỚ`, drains right-to-left, and shows the remaining seconds (`2.0s → 0.7s`). It is a `role="progressbar"` with `aria-valuenow`.
- The meter is visible only during `FLASH`; it is removed from the accessibility tree otherwise.

## Answer Timing

- `CHỌN NGAY!` replaces the old `CHỌN N Ô ĐÃ SÁNG`; the target count moves to the helper line with the remaining seconds.
- The answer window is 5.0s at level 1 and 2.15s at level 14.
- When the window closes, the client submits `{ timeout: true }`. The server validates that the response is not before `selectMs`, marks the round as failed, increments `timeoutCount`, and the review overlay reveals the expected pattern with `✓ / × / ◇`.
- Non-timeout submissions after `selectMs + 200ms` are rejected by the authoritative replay.
- A correct answer still auto-submits 220ms after the last cell, so the player is not forced to hunt for a confirm button.

## Pattern Complexity

Eight deterministic families:

| Family | Intent |
|---|---|
| `scattered` | no mnemonic structure |
| `asymmetric` | 60% odd-parity + 40% even-parity, never a pure checkerboard |
| `edge_center` | half border, half interior |
| `split_clusters` | 2–3 separated clusters |
| `near_symmetry` | mirrored set with 1–2 deliberate breaks (the “remember half and get it wrong” trap) |
| `line` | contiguous row/column segment |
| `corners` | corners only |
| `block` | 2×2 / L block |

Weights interpolate from level 1 to 14. At level 1 the three easy families carry ~40% of the weight; at level 14 they carry ~8.5%. A 6% “easy slot” keeps them present at every level — the requirement is to reduce frequency, not remove them.

### `patternDifficulty` heuristic

`patternDifficulty(cells, size)` scores 0–100 from:

- information load (`targets × 3.2`, capped 34);
- spread (bounding-box area / grid area);
- adjacency (touching cells create chunks and are easier);
- edge ratio (border-only patterns are easier to locate);
- symmetry (perfect symmetry is heavily penalised; near-symmetry only lightly, because it is a trap);
- straight-line and filled-block penalties;
- corner-only penalty.

The generator rejection-samples up to 14 candidates and returns the first one at or above `patternFloor(level)`, otherwise the hardest candidate. This prevents “level 12 but easier than level 3”.

Measured over 400 seeds per level (`difficulty-curve.json`):

| Level | Grid | Targets | Reveal | Answer | p10 | Median | p90 | Low-difficulty rate |
|---|---|---|---|---|---|---|---|---|
| 1 | 3×3 | 2 | 2000 | 5000 | 4.4 | 20.4 | 26.4 | 91.5% |
| 2 | 3×3 | 3 | 1850 | 4800 | 11.6 | 20.3 | 36.9 | 83.0% |
| 3 | 3×3 | 3 | 1700 | 4600 | 11.6 | 20.3 | 35.6 | 83.8% |
| 4 | 4×4 | 4 | 1500 | 4300 | 20.3 | 33.3 | 45.3 | 37.5% |
| 5 | 4×4 | 5 | 1380 | 4000 | 25.4 | 39.1 | 50.8 | 19.3% |
| 6 | 4×4 | 6 | 1260 | 3800 | 30.5 | 42.6 | 51.2 | 5.0% |
| 7 | 5×5 | 6 | 1140 | 3500 | 35.1 | 46.5 | 55.9 | 2.5% |
| 8 | 5×5 | 7 | 1030 | 3200 | 40.4 | 52.1 | 58.7 | 0.3% |
| 9 | 5×5 | 8 | 930 | 2900 | 45.8 | 52.9 | 59.1 | 0% |
| 10 | 5×5 | 9 | 850 | 2600 | 50.9 | 56.7 | 62.1 | 0% |
| 11 | 5×5 | 9 | 800 | 2450 | 50.3 | 57.1 | 62.5 | 0% |
| 12 | 5×5 | 10 | 770 | 2350 | 54.4 | 58.4 | 63.4 | 0% |
| 13 | 5×5 | 10 | 740 | 2250 | 57.8 | 60.2 | 64.2 | 0% |
| 14 | 5×5 | 11 | 720 | 2150 | 62.6 | 64.7 | 67.3 | 0% |

Median and p90 rise monotonically. p10 has a 0.6-point dip at level 11 caused by the deliberate 6% easy slot; the floor still rises.

## Endgame Pressure

- `MEMORY_RUSH_LEVEL = 9` (round 17). The HUD shows a `MEMORY RUSH!` badge and the reveal bar turns amber.
- The answer bar turns red, pulses subtly (`translateY(-1px)`, 700ms) and switches the label to `SẮP HẾT GIỜ!` below 25% of the window.
- No board shake, no tile occlusion; pressure is expressed on the meters and the badge.
- The tier is **index-based**, not wall-clock-based, so every player receives identical parameters for the same challenge index (multiplayer fairness).

## Dynamic Difficulty Ramp

Not enabled. `challenge()` is a pure function of `(seed, index, rulesVersion)`. Using personal streak or accuracy to accelerate difficulty would make two players in the same 2V2/3V3 receive different reveal/answer windows for the same index, violating the fairness requirement. The index-based curve is already aggressive enough that a strong player reaches level 14.

## Multiplayer Fairness

- Same `seed`, same pattern, same grid, same targets, same reveal and answer windows for every player in a room.
- Team modes do **not** generate per-player patterns.
- `restMs` after a wrong answer is the only per-player value (680ms early, 620ms late); it is a local pause, not a different challenge.
- Browser audit compares the lit-cell sets captured by every context for shared round indices.

---

## Mode Audit

### Before this change

| Mode | Capacity | Teams | UI label |
|---|---|---|---|
| `SOLO` | 1 | none | Solo |
| `DUO` | 2 | none | “Đấu 1v1” |
| `TRIO` | 3 | none | “3 người tranh hạng” |

`shared/arcade/engine.mjs` exported `CAPACITY = { SOLO: 1, DUO: 2, TRIO: 3 }`. The backend validated modes with `Object.keys(CAPACITY).includes(mode)`. The UI mode picker hard-coded the same three strings.

### What happened to 2V2

`2V2` **never existed in the Arcade engine**. It was not removed by a UI change, an enum change or a capacity mapping loss. The Arcade room engine was introduced on 2026-10-21 with `SOLO`/`DUO`/`TRIO` only. The legacy Typing Battle engine already had `SOLO`, `1V1`, `TRIO`, `2V2`, `3V3` enums and team seats, which is why the capability looked “lost” when the new games were added.

There was therefore no old Arcade 2V2 code to reuse. The correct fix was to extend the **shared Arcade room engine** (the one Computer Rush, Direction Rush and Memory Flash already use), not to build a Memory-specific room system.

### Trio vs 3v3 naming audit

- `TRIO` = **3 total players**, free-for-all, no teams. It is **not** 3v3.
- `3V3` = **6 total players**, Team A 3 vs Team B 3.

Both are kept. `TRIO` remains a valid product mode (existing rooms and leaderboard rows depend on it), but it is labelled `TRIO · 3 người · tranh hạng` and is visually separated from `3V3 · 6 người · 3 đấu 3`. Nothing is renamed into a lie.

`DUO` is renamed to `1V1` for new rooms. Existing `DUO` rows are migrated to `1V1`; the API still accepts `DUO` as an alias for old clients.

### Canonical registry

`shared/arcade/modes.mjs`:

```text
SOLO  capacity 1  teamSize 0  teamMode false
1V1   capacity 2  teamSize 1  teamMode false
TRIO  capacity 3  teamSize 0  teamMode false
2V2   capacity 4  teamSize 2  teamMode true
3V3   capacity 6  teamSize 3  teamMode true
```

`capacityFor`, `modeSpec`, `canonicalMode`, `balancedTeam`, `teamCounts`, `teamsAreBalanced`, `teamScore`, `aggregateTeams`, `teamOutcome` live in that file. Frontend, backend and engine import it; no magic `1/2/3/4/6` is repeated.

---

## Shared Room Integration

Reused, not duplicated:

- `ArcadeRoom` / `ArcadePlayer` models.
- `arcade.service` create/join/ready/start/progress/finish/leave/rematch/sweep.
- `/api/games/arcade/*` routes and `arcade:*` socket events.
- The same heartbeat/grace/sweep logic for disconnect.

Added:

- `arcade_players.team` (`'A' | 'B'`, nullable).
- Migration `20261022190000-arcade-team-modes` (add column, `DUO → 1V1`, backfill teams for existing team rooms).
- `POST /api/games/arcade/rooms/:id/team` for pre-start team switching.
- `pack()` now returns `room.teamMode`, `room.teamSize`, `room.modeLabel`, per-player `team`, and a `teams` aggregate.

No Memory-specific room system exists.

---

## 1V1

- 2 real players, capacity 2, individual ranking.
- Same shared engine, same seed, same timings.
- Result screen keeps the individual podium (`#1`, `#2`).
- Title uses `BẠN THẮNG 1V1!` / `<name> chiến thắng!`.

## 2V2

- 4 real players, Team A 2 vs Team B 2.
- Host is placed in Team A; joiners are auto-balanced (`A, B, A, B`).
- Capacity race: with one slot left, exactly one of two concurrent joins succeeds (tested).
- 5th join is rejected with `Phòng đã đầy`.
- Team switch before start is allowed while the target team has space; every switch resets all ready flags.
- Start requires `4/4`, all ready, and exactly `2 + 2`. `3 vs 1` is rejected.
- If a player leaves, the room becomes `2 vs 1`; start is blocked until a new player fills the empty team.

## 3V3

- 6 real players, Team A 3 vs Team B 3.
- Auto-balance produces `A, B, A, B, A, B`.
- Start requires `6/6`, all ready, and exactly `3 + 3`.
- 7th join is rejected.

## Team Scoring

Server-side, computed once when all players finish (`closeIfFinished`). Client scores are never summed.

```text
teamScore = round(
    0.75 × average(player.score)
  + 0.25 × min(player.score)
  + 3    × average(player.accuracy)
)
```

Rationale:

- The `min` term is deliberate. A team of `[5000, 0]` scores 2010; a balanced `[2500, 2500]` scores 2740. One pro cannot carry a dead seat.
- The accuracy term (max 300) rewards clean team play without outweighing score. It only counts players with at least one attempt; otherwise `emptyMetrics.accuracy = 100` would give both teams a free 300 at kick-off (found in the mobile HUD audit and fixed).
- All team members must be present before start, so “duplicate participant” exploits are impossible.

Tie-break: team score → total correct → accuracy → team id.

Each player result stores `team`, `teamScore`, `teamRank`, `teamWon`, `teamSize`, `teamTotal`, `teamAccuracy`.

## Team UX

- **Lobby**: two columns, `TEAM A` / `TEAM B`, each with avatar, name, ready state and empty slots. A note states the required `N vs N`; the start button is disabled until balanced.
- **During play**: a compact `TeamHud` above the board shows both team scores, total correct, accuracy, and one line per member (`✓` finished, `×` last answer wrong, `◇` playing). The local board remains the only board on screen; no 6-board layout.
- **Result**: `🏆 TEAM A THẮNG!` (or `HAI ĐỘI HOÀ!`), then two team cards with each member’s score, correct count and accuracy, and a `TỔNG ĐỘI` footer.
- **1V1**: individual podium, no team cards.

## Team Reward

- XP is granted through `ScoreLedger` with `idempotencyKey = arcade:<playerId>`, unique per player.
- Team modes defer the reward until the team result is known, then grant `base + 6 XP` for the winning team in a single ledger row.
- Retries, duplicate `finish` calls and concurrent finalize do not create a second row. Tested for 2V2 and 3V3.
- Non-team modes keep the previous immediate grant.

## Replay Same Group

`rematch` keeps `mode`, `capacity`, room membership and **teams** (each player’s previous team is restored if that team still has space). It creates a new `matchId` and a new `seed`. Verified in service tests and in the browser for 1V1, 2V2 and 3V3.

---

## Mobile

- Max grid is **5×5**. 6×6 was evaluated and rejected: at 390px the board is 304px wide; with 10px padding, 8px border and 7px gaps, six columns leave ~40px per tile, below the 44px touch target and forcing overflow because tiles have `min-width: 44px`.
- At 390px and 430px, 5×5 tiles render at **49–51px**, above the 44px minimum.
- Hard mode adds targets and speed instead of grid size, so mobile difficulty still ramps.
- The team HUD collapses to one column below 700px; the lobby team columns stack.

## Accessibility

- Keyboard grid navigation (arrows, Home, End) is preserved.
- Cell state never relies on colour alone: `✓` correct, `×` incorrect, `◇` missed, `✦` lit, plus `aria-label` per cell and `aria-pressed`.
- The reveal meter and answer bar are `role="progressbar"` with `aria-valuenow`.
- Phase changes are announced with `role="status"` / `aria-live="polite"`.
- `prefers-reduced-motion` and the app’s reduce-motion flag disable the rush pulse and the tick animation.

## Performance

- 120 deterministic rounds generated and replayed without duplicate or stale state (`arcade_engine.test.js`).
- Duplicate index, backward timestamps and post-deadline submissions are rejected by replay.
- `MemoryBoard` clears its pending auto-submit on index change and on unmount; the timeout effect is guarded by the expected index, so a late timer cannot submit into the next round.
- `ArcadePlay` clears its feedback timer on unmount and on every new submission.
- Team `pack()` is O(players) and runs the same replay it already ran for individual metrics.

## Tests

### Automated

```text
node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 \
  test/arcade_engine.test.js test/arcade_http.test.js test/arcade_service.test.js \
  test/arcade_vocabulary.test.js test/arcade_team_modes.test.js test/game_catalog.test.js \
  test/typing_room_lifecycle.test.js test/socket_room_auth.test.js
```

Result: **64 pass / 0 fail** (48 top-level tests, 64 including subtests).

Full backend suite: **644 pass / 10 fail / 1 skipped (655 tests)**. The 10 failures are the same pre-existing competition/integration/MVP failures recorded earlier today (`competition_phase3`, `competition_phase5_hardening`, `competition_phase9_performance`, `competition_phase9_security`, `integration`, `mvp_cup_comprehensive_e2e`); none touch arcade code. The targeted arcade + typing lifecycle suite is 64/64 green.

New coverage:

- `Memory v3`: monotonic curve on every axis, 60s reachability, pattern-difficulty ramp, easy-family ratio drop, determinism, exact cell count, timeout evidence, legacy v2 compatibility.
- `Memory rapid rounds`: 120 rounds, no duplicate consecutive pattern, duplicate index and backward time rejected.
- `Mode registry`: `1V1=2`, `2V2=4`, `3V3=6`, `TRIO=3`, `DUO → 1V1`, `TRIO ≠ 3V3`.
- `2V2`: 4 seats, auto-balance, capacity race, 5th join rejection, start gate, team switch, leave → 2v1 → start blocked → refill → 2v2, full match on a shared seed, server team score, team result, reward once, duplicate finalize, rematch keeps teams.
- `3V3`: 6 seats, 3+3, 7th join rejection, ready/start, full match, team fields, leaderboard mode isolation.
- `Team score cannot be carried by one pro player`.
- `2V2 room engine is shared by every arcade game` (Computer Rush, Direction Rush).

### Browser

`frontend/scripts/memory-flash-team-modes-audit.mjs` — real Chromium, mobile viewport 430×932:

- SOLO 60s: captures every round’s level/size/reveal and asserts the ramp.
- 1V1 with 2 contexts.
- 2V2 with **4 contexts** (A1, A2, B1, B2).
- 3V3 with **6 contexts** (A1–A3, B1–B3).
- Per match: lobby team columns, ready, start, identical patterns across contexts, team HUD, team result, rematch with preserved teams and new seed.

Result: **15/15 checks, 0 page errors, 0 console errors**.

| Mode | Contexts | Evidence |
|---|---|---|
| SOLO | 1 | 28 rounds in 60s; level 1 (3×3, 2 targets, 2.0s) → level 14 (5×5, 11 targets, 0.7s); 27/27 correct |
| 1V1 | 2 | identical patterns on shared rounds; two distinct ranks |
| 2V2 | 4 | teams 2+2; identical patterns; TEAM B 14,677 vs TEAM A 14,205; rematch kept teams, new seed |
| 3V3 | 6 | teams 3+3; identical patterns; TEAM B 10,450 vs TEAM A 10,449; rematch kept teams, new seed |

The SOLO probe reads the lit cells from the DOM, so it has perfect recall. The 27/27 result is a **pacing** measurement (the curve is reachable and the UI does not block fast play), not a claim about human difficulty. A human tester is still required to confirm perceived pressure.

The 3V3 contexts produced 22 rounds versus 28 in SOLO because six Chromium contexts shared one host CPU. That is an audit-environment artifact; the challenge parameters are identical.

Mobile (`frontend/scripts/memory-mobile-audit.mjs`, `memory-team-hud-audit.mjs`):

| Viewport | Board | Tile | Columns | Overflow | 3V3 HUD |
|---|---|---|---|---|---|
| 430×932 | 304px | 49.6 × 48.8px | 5 | none | 60px, 2 columns |
| 390×932 | 304px | 49.6 × 48.8px | 5 | none | 60px, 2 columns |

At 390px the 3V3 board starts at y=419 with `scrollY=0`; both team blocks share the same top, so the board and answer timer stay above the fold.

---

## Remaining Risks

1. **Team leaderboard semantics.** The board is filtered by mode and exposes `team`, `teamScore` and `teamWon`, but rows are still ranked by individual score. A true “team standings” table (one row per team per match) is not implemented. Cross-mode mixing is prevented; team aggregation is not.
2. **Reward tuning.** The winning-team bonus is `+6 XP` on top of the existing `min(30, score/200)`. This is a product value, not a measured optimum.
3. **6×6 is disabled.** Deliberate, because of the 44px touch target at 390px. If 6×6 is wanted later, it needs a different mobile board (smaller gaps, zoom, or a landscape-only layout) and a fairness decision, since all players must receive the same grid.
4. **Clock tolerance.** MySQL `DATETIME` truncates/rounds `started_at` to the second. The server previously allowed only 150ms of future-event skew, which rejected legitimate Memory submissions. The tolerance is now 1500ms. This is safe for scoring (`at <= durationMs`, and `finish` still checks the wall clock) but it is a wider window than before.
5. **Browser QA on one machine.** 6 contexts were real and concurrent, but on a single host with no network partition, no reconnect mid-team-match and no cross-region latency. The existing heartbeat/grace logic is reused but was not re-exercised under packet loss this round.
6. **Typing Battle still has a separate room engine.** Pre-existing architectural debt; out of scope. The new mode registry is shared by the Arcade engine only.
7. **Old Memory leaderboard rows.** `rulesVersionFor('memory_flash')` is now 3, so v2 rows are excluded from the new board by design (different difficulty and scoring). This resets the visible Memory leaderboard; historical rows remain in the database.
8. **Pattern-difficulty heuristic is a heuristic.** It correlates with human memorability but was not calibrated against a large human sample. It is monotonic in the tested distribution, not a proof of perceived difficulty.
9. **Human feel not tested.** The SOLO probe has perfect recall and therefore cannot say whether a human finds the early game welcoming or the RUSH tier stressful. A human playtest (one SOLO run to RUSH, one 2V2 and one 3V3 with real people) is still required before freezing the numbers.

---

## Final Gates

| Gate | Result | Evidence |
|---|---|---|
| `MEMORY_EARLY_GAME_ACCESSIBLE` | **PASS** | Level 1–3: 3×3, 2–3 targets, 2.0–1.7s reveal, 5.0–4.6s answer. Browser run completed the first rounds without timeout. |
| `MEMORY_MID_GAME_DIFFICULTY` | **PASS** | Level 4–6: 4×4, 4–6 targets, 1.5–1.26s reveal, 4.3–3.8s answer; pattern median 33–43. |
| `MEMORY_LATE_GAME_DIFFICULTY` | **PASS** | Level 7–9: 5×5, 6–8 targets, 1.14–0.93s reveal, 3.5–2.9s answer; pattern median 46–53. |
| `MEMORY_SPEED_RAMP` | **PASS** | Prepare 320→190ms, hide 150→100ms, rest 420→215ms, feedback 800→560ms (wrong) and 330→220ms (correct). |
| `MEMORY_REVEAL_TIME_RAMP` | **PASS** | 2000ms → 720ms, strictly decreasing at every level; asserted in `arcade_engine.test.js`. |
| `MEMORY_ANSWER_TIMER` | **PASS** | 5000ms → 2150ms; timeout is server-validated, counted and reviewed. Non-timeout late submits are rejected. |
| `MEMORY_PATTERN_COMPLEXITY` | **PASS** | 8 families, level-weighted; `patternDifficulty` floor + 14 rejection samples; median 20→65 across levels. |
| `MEMORY_ENDGAME_PRESSURE` | **PASS** | `MEMORY_RUSH!` from level 9; amber reveal bar, red pulsing answer bar below 25%; browser reached level 14. |
| `MEMORY_MOBILE_HARD_MODE` | **PASS** | 5×5 at 390px and 430px: tile 49.6×48.8px, board 304px, no horizontal overflow. |
| `1V1_ROOM` | **PASS** | Capacity 2; 2 real browser contexts; distinct ranks; rematch new seed. |
| `2V2_MODE_RESTORED` | **PASS** | Capacity 4; create/join/list/leaderboard accept `2V2`; service + browser. |
| `2V2_TEAM_ASSIGNMENT` | **PASS** | Auto-balance A,B,A,B; lobby shows 2+2; team switch blocked when full; switch resets ready. |
| `2V2_READY_START` | **PASS** | 4/4 + all ready + exactly 2+2; 3v1 rejected; 5th join rejected. |
| `2V2_TEAM_SCORING` | **PASS** | Server `teamScore`; browser TEAM B 14,677 vs A 14,205; per-player team fields stored. |
| `2V2_REAL_4_PLAYER_TEST` | **PASS** | 4 Chromium contexts (A1, A2, B1, B2), full match + result + rematch. |
| `3V3_IS_ACTUALLY_6_PLAYERS` | **PASS** | Capacity 6; 6 Chromium contexts; teams 3+3; 7th join rejected. |
| `3V3_READY_START` | **PASS** | 6/6 + all ready + exactly 3+3. |
| `3V3_TEAM_SCORING` | **PASS** | Browser TEAM B 10,450 vs A 10,449; team result cards for 3 members. |
| `SHARED_ROOM_ENGINE` | **PASS** | Same `ArcadeRoom`/`ArcadePlayer`/`arcade.service`/socket; no Memory-specific room system. 2V2 also verified for Computer and Direction. |
| `MULTIPLAYER_SAME_CHALLENGE` | **PASS** | Identical lit-cell sets for every shared round index in 1V1, 2V2 and 3V3. |
| `TEAM_REWARD_IDEMPOTENCY` | **PASS** | One `ScoreLedger` row per player; duplicate finish does not add rows (2V2 + 3V3 tests). |
| `REPLAY_SAME_GROUP` | **PASS** | Rematch keeps mode, capacity, membership and teams; new seed. Verified in browser for all three modes. |
| `OTHER_GAMES_ROOM_REGRESSION` | **PASS** | Targeted arcade + typing lifecycle suite 64/64; full suite 644/655 with the same 10 pre-existing competition/integration failures. |
| `OVERALL_MEMORY_FLASH` | **PASS** | All technical gates above pass. See the playtest caveat below. |

### Playtest caveat

The SOLO playtest was executed by an automated browser probe with **perfect recall** (it reads the lit cells from the DOM). It proves that the curve is reachable, the UI does not block fast play, and the endgame is materially faster (28 rounds, level 14, 0.7s reveal). It does **not** prove how a human perceives the pressure.

A human playtest (at least one full SOLO run to RUSH, plus one 2V2 and one 3V3 with real people) is still recommended before calling the *feel* final. This is the only item that automation cannot close; it is listed in Remaining Risks.
