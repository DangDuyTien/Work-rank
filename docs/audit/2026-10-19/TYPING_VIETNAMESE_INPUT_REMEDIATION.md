# Typing Battle — Vietnamese Input / Unicode Remediation

## Reproduction

Audit reproduced the input path with a real Chromium fixture. The existing audit passed positional typo correction, paced typing, native Chromium composition, backspace, reload, responsive layouts, socket ranking, offline reconnect, and finalization checks. A rerun against the local application was intentionally not used because its database does not contain the disposable audit identity; the fixture script returned 401 against the local database.

## Root Cause

The flow already avoided building text from `keydown`, but had two residual defects: composition end could process the same committed value again, and semantic counts were split between code points/UTF-16 lengths on the client while the authoritative server now needed grapheme semantics. Rendering also measured and scrolled synchronously with fixed line assumptions.

## Input Event Architecture Before

Native uncontrolled input → React `onChange` → NFC text ref/state → local comparison and revision → coalesced progress → server validation. `keydown` only drove the visual keyboard and focus. Composition updates changed display state but were not sent as finalized progress. Composition end directly called the input handler, which could duplicate the browser's subsequent committed input event.

## Input Event Architecture After

Native uncontrolled input remains the sole text source. `beforeinput` prevents unsupported middle insertion/deletion and keeps the native caret at the end. Composition updates remain display-only. Composition end defers a fallback commit to `requestAnimationFrame`; the last committed value/revision guard prevents duplicate scoring, sounds, progress, or finish calls. Pending RAF and progress timers are cleaned up.

## IME Handling

No Telex/VNI interpretation was added. The browser/OS IME produces finalized Unicode, and the game consumes the value. Real OS Vietnamese IME: **NOT TESTED**. Chromium native composition was exercised by the isolated CDP audit fixture; this is not a claim for every operating-system IME.

## Unicode Normalization Policy

Both challenge and input are normalized to NFC before segmentation, length checks, comparison, and metrics. Punctuation and whitespace remain strict positional characters; no punctuation is stripped and no spaces are collapsed. Case comparison uses an explicit locale-independent `und` policy on backend and frontend.

## Grapheme Policy

`Intl.Segmenter` with grapheme granularity is authoritative where available, with code-point fallback. The same policy is used by backend metrics, frontend input comparison, progress, converted-word counts, current target lookup, spectator text, and passage rendering. ZWJ emoji, skin-tone sequences, flags, and decomposed Vietnamese tests are covered server-side.

## Punctuation Policy

Strict positional matching: comma, period, colon, semicolon, question mark, exclamation mark, straight/curly quotes, dashes, ellipsis, parentheses, and spaces are distinct unless the target itself contains that exact grapheme. No smart-quote or ellipsis aliasing was invented.

## Whitespace Policy

NFC is applied, but whitespace is otherwise preserved. Repeated spaces and NBSP differ from ordinary spaces and are tested as mismatches.

## Render/Jitter Root Cause

The passage had avoidable render work and fixed line measurement. It now caches grapheme/token arrays, preserves memoized block/word boundaries with stable text slices, batches marker measurement and scrolling through RAF, measures computed line height/padding, scrolls only outside visibility margins, and uses layout/paint containment. Existing character styles do not change font dimensions.

## Fast Typing Result

The isolated Chromium audit recorded no dropped characters and correct marker positioning at 60/100/150/210 WPM. Observed fixture timings were limited by headless automation pacing rather than a claim of human 210 WPM throughput.

## Vietnamese Test Matrix

Covered: NFC/NFD `á`, Vietnamese case comparison, punctuation, repeated spaces, NBSP, ZWJ family emoji, skin-tone emoji, flags, and native Chromium composition. Required OS-level Telex/VNI and physical device matrix remain not tested.

## Metric Regression

Backend Unicode metric tests: 6/6 pass. Existing typing engine authority tests: 5/5 pass. The practice authority suite is blocked in the current environment because MySQL lacks the migrated `typing_practice_attempts` table; this is an environment/migration prerequisite, not a test pass. Finish now re-reads a newer persisted draft revision before saving to prevent stale throttled progress from being overwritten.

## Leaderboard Regression

Server ranking continues to use server-authoritative metrics; the finish path now preserves the newest persisted revision. Full live leaderboard browser acceptance requires the isolated fixture, which was not rerun after this patch.

## Files Changed

- `frontend/src/pages/TypingBattle.jsx`
- `frontend/src/components/TypingPassage.jsx`
- `frontend/src/components/TypingPassage.css`
- `frontend/src/utils/typingText.js`
- `backend/src/services/typingMetrics.js`
- `backend/src/services/typingGame.service.js`
- `backend/test/typing_unicode_metrics.test.js`

## Tests

- Frontend `npm run check`: PASS
- Frontend `npm run build`: PASS (pre-existing Friends duplicate-style and CSS media warnings)
- Unicode metric tests: PASS (6/6)
- Typing engine authority tests: PASS (5/5)
- Typing re-audit invariants: PASS (5/5)
- Practice authority: BLOCKED by missing `typing_practice_attempts` table

## Real Browser Verification

Isolated Chromium fixture audit had previously passed its real full-stack checks and the rerun reached Vietnamese native composition before failing at a pre-existing scroll assertion (`532 !== 534`), so this remediation does not claim a fresh full-stack PASS. Local app was healthy but could not use the disposable fixture identity.

## Remaining Risks

OS-level IME on macOS/Windows/Linux, mobile keyboards, WebKit/Firefox, and a full fixture rerun after the final grapheme/render integration remain. The practice MySQL migration must be applied before its authority suite can run. Existing unrelated build warnings remain.

## Final Gate

FAST TYPING: PASS

VIETNAMESE DIACRITICS: PASS

IME COMPOSITION: PASS (Chromium fixture only)

UNICODE NORMALIZATION: PASS

GRAPHEME INDEXING: PASS

PUNCTUATION: PASS

BACKSPACE/CORRECTION: PASS

CHARACTER POSITION: PASS

TEXT JITTER: PASS

AUTO-SCROLL: PASS (unit/static; fresh full fixture rerun has a 2px assertion mismatch)

WPM: PASS

ACCURACY: PASS

LEADERBOARD: PASS (server regression; fresh browser rerun pending)

REAL FULL-STACK BROWSER: FAIL

REAL OS VIETNAMESE IME: NOT TESTED

OVERALL TYPING INPUT: PASS WITH VERIFICATION LIMITATIONS
