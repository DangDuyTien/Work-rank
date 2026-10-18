# WorkRank — Full Product Remediation Plan

**Date:** 2026-10-18 (Asia/Ho_Chi_Minh)
**Baseline:** `docs/audit/2026-10-17/MASTER_AUDIT_REPORT.md`
**Current decision:** **HOLD / NO-GO**

## Team Composition

| Area | Audit owner | Cross-review requirement |
|---|---|---|
| Dashboard / YouTube / analytics | Dashboard specialist | Global UX + data-integrity review |
| Ranking / competition | Ranking specialist | Dashboard/data specialist review |
| Collaboration / social | Social specialist | Account/global UX review |
| Games / realtime | Games specialist | Global UX + backend/security review |
| Account / settings / navigation | Account/global UX specialist | Auth/backend + games review |
| Product inventory / synthesis | Team lead | Final regression gate |

No teammate edited product files during the investigation. This report is an evidence-backed remediation plan, not a claim that the listed fixes are already implemented.

## Root Cause Groups

### RCG-01 — Authority and privacy boundaries

Drawing visibility, game ownership, historical team attribution, and token revocation are enforced inconsistently at service boundaries. UI assumptions cannot substitute for server-side ownership and policy checks.

Affected: WR-GAME-001/002, WR-RANK-007/008, WR-AUTH-001/003, historical BUG-001/002/003.

### RCG-02 — Time, period, and snapshot semantics

Several APIs accept range/period parameters but calculate from current-season or fixed 30-day summaries. Projection rebuilds and season finalization do not consistently reconcile snapshots.

Affected: WR-DASH-001/003, WR-RANK-001/002/003/004/005/006/007/008.

### RCG-03 — Optimistic unknown/error handling

Admin Operations catches individual request errors and renders successful-looking fallbacks. The frontend also expects response fields that differ from backend contracts.

Affected: WR-OPS-001/002/003, historical BUG-013.

### RCG-04 — Client-controlled scoring and lifecycle ordering

Typing duration and completion data are client-influenced, and timeout conversion occurs after winner selection. 2048 allows stale active sessions.

Affected: WR-GAME-002/003/004 and current typing finalization regression.

### RCG-05 — Relationship concurrency and realtime acknowledgement

Friend requests, kudos, notifications, and chat read state have race, idempotency, user-scope, or acknowledgement gaps.

Affected: WR-SOC-001/002/003/004/005/006.

### RCG-06 — Shared shell and legacy navigation

Global Layout reads settings/notifications only on mount, mobile CSS hides key actions, and legacy Capital Board code remains partially routed.

Affected: WR-UX-001/002/003/004/005/009, historical BUG-014/016/017/020/021/023.

## Fix / Remove / Merge / Add Decisions

| Surface | Decision | Rationale |
|---|---|---|
| Drawing gallery/detail visibility | FIX | Useful feature; authorization boundary is incomplete |
| Ranking ranges/projections/snapshots | FIX | Core authoritative data must be corrected, not hidden |
| Admin Operations | FIX | Operational observability is useful; align schema and unknown states |
| Typing scoring/finalization | FIX | Core realtime game and ranking integrity |
| 2048 active-session lifecycle | FIX | Preserve game, enforce one authoritative active session |
| Social notifications/friend/kudos/chat | FIX | Existing actions need correct relationship semantics |
| Capital Board navigation | REMOVE or restore coherently | Current route redirects to UNO and legacy room URL is unmatched |
| `Groups.jsx` | MERGE/archive after consumer check | `/groups` already canonicalizes to Friends |
| Footer legal/API labels | ADD real destinations or REMOVE | Current spans are dead UI |
| Wildcard route | ADD contextual 404 | Redirecting unknown paths to home hides invalid URLs |
| New dashboard widgets | DO NOT ADD | Existing correctness and trust issues take priority |

## Prioritized Remediation Backlog

### P0

No P0 was proven in this audit. Continue treating privacy and scoring defects as release blockers even when classified P1.

### P1 — Release blockers

| ID | Root cause | Minimal remediation | Acceptance evidence |
|---|---|---|---|
| WR-GAME-001 | RCG-01 | Enforce visibility, owner, team membership, and authenticated policy in `drawing.service.js`; do not allow `visibility=ALL` to bypass policy. | Anonymous/user B cannot read A’s PRIVATE/TEAM drawing; owner/team can; public gallery remains public-only. |
| WR-RANK-001 | RCG-02 | Aggregate ScoreLedger by requested date bounds for daily/monthly/yearly or expose correctly named projections. | Same fixture returns different totals for today/month/year; no old-season points in today. |
| WR-RANK-002 | RCG-02 | Reconcile/delete projection keys absent from authoritative ranking inside the same transaction. | Removing/disqualifying member/team removes it from ranking API and UI. |
| WR-RANK-003 | RCG-02 | Require explicit SeasonTeam snapshots or document a deliberate registration policy; never silently fall back to every Team. | Empty season has no participants and awards no unregistered teams. |
| WR-DASH-001 | RCG-02 | Represent mixed sync state as PARTIAL/FAILED with channel-level errors; UI must not call it fresh. | One failed + one successful channel produces visible partial failure and freshness details. |
| WR-DASH-003 | RCG-02 | Compute team summary for requested period or remove period selector and label fixed 30-day semantics. | 7d/30d/90d fixtures produce period-specific results and labels. |
| WR-GAME-003 | RCG-04 | Derive duration from server start/finish timestamps; bound or ignore `clientDurationMs`. | Forged 1-second duration cannot change WPM/rank; server elapsed time is authoritative. |
| WR-OPS-001 | RCG-03 | Track each request’s error/staleness state and render Unknown/Unavailable instead of optimistic values. | Inject null/500 responses; no `ONLINE`, `100%`, `Vừa xong`, or green consistency claim appears. |
| WR-OPS-002 | RCG-03 | Normalize frontend/backend response contract: backend `summary.*` and actual health fields, or update UI selectors. | API fixture values appear in correct cards; missing fields do not become zero/healthy. |
| WR-AUTH-001 | RCG-01 | Include token version in access JWT or validate DB token version in auth middleware and socket handshake. | Access token issued before password change is rejected immediately over HTTP and Socket.IO. |
| WR-AUTH-002 | RCG-01 | Do not broadcast destructive revocation to the initiating password-change session; rotate/update its token state explicitly. | Password change succeeds and initiating browser remains authenticated; other sessions are revoked. |
| Current typing finalization regression | RCG-04 | Convert timed-out players and calculate performance before building eligiblePlayers/winner. | Best timed-out eligible player can win; timeout and submitted-player races are deterministic. |

### P2 — Required before broad release

- WR-RANK-004/005/006/007/008: canonical all-time aggregation, stable tie-break timestamps, transaction propagation, season membership filtering, and event-time team attribution.
- WR-GAME-002: enforce one active 2048 session per user or close/reconcile older sessions; reject checkpoint/submit for finalized sessions.
- WR-GAME-004: clarify and enforce the intended 90% completion threshold; add completion-bonus tests.
- WR-SOC-002: canonical unordered friendship uniqueness plus transaction/upsert.
- WR-SOC-003/005: render relationship-aware actions and filter inactive users.
- WR-SOC-004: require stable idempotency key derived from the kudos operation; transaction/outbox both score events.
- WR-SOC-006: socket acknowledgement timeout with HTTP read fallback.
- WR-UX-001: retain or relocate notification/settings actions on mobile.
- WR-UX-002/004: subscribe Layout to settings updates and enforce notification preferences.
- WR-UX-003: consume one canonical auth notice key on Login.
- WR-UX-005: remove stale Capital Board item or restore its full route tree.
- WR-UX-009: validate finite positive user IDs before API call.
- Historical BUG-014/016/017/019/020/021/022: rerun and fix after current-tree verification.

### P3 — Cleanup and polish

- Stable fallback keys for malformed member records.
- Avatar-local deletion state semantics.
- Profile lightbox Escape/focus/dialog semantics.
- Replace or remove dead footer labels.
- Archive unused Groups/Capital Board source only after dependency and migration checks.

## Changes By Area

### Dashboard / YouTube

1. Define explicit freshness enum: `UNKNOWN`, `FRESH`, `STALE`, `PARTIAL_FAILURE`, `FAILED`.
2. Keep source period in API response and UI labels.
3. Add mixed-failure, period, zero-channel, stale, and partial-sync tests.
4. Fix chart label sampling to guarantee the documented maximum.

### Ranking / Competition

1. Choose one authoritative ledger/projection contract per range.
2. Make projection rebuild a full reconciliation, not only an upsert.
3. Freeze season participant/team membership before finalization.
4. Pass transaction context through calculators and projectors.
5. Add tests for empty season, disqualification, team move, all-time, ties, and date ranges.

### Collaboration / Social

1. Scope notifications by authenticated user and reset on identity change.
2. Make friendship pair uniqueness symmetric/canonical.
3. Use relationship state to determine available chat action.
4. Use stable kudos idempotency and atomic event/outbox persistence.
5. Persist chat read state with ack/fallback.

### Games

1. Enforce drawing policy before query results leave the service.
2. Make 2048 active-session and terminal-state transitions explicit.
3. Use server timestamps for typing timing and score.
4. Order timeout finalization before winner selection.
5. Maintain socket snapshot/reconnect tests and add authenticated browser scenarios.

### Account / Settings / Global UX

1. Implement token-version checks consistently in HTTP and sockets.
2. Preserve initiating password-change session while revoking other sessions.
3. Render auth notices once on Login.
4. Subscribe shell to settings and notification preference events.
5. Resolve Capital Board route ownership and add a 404 page.
6. Keep mobile primary actions accessible and test 390/430px widths.

## Files Changed

The audit itself adds:

- `docs/audit/2026-10-18/FULL_PRODUCT_AUDIT.md`
- `docs/audit/2026-10-18/FULL_PRODUCT_REMEDIATION.md`

The working tree already contained broad uncommitted application changes before this audit. No product source files were modified by the audit investigation. The existing modified/untracked application files must be reviewed and committed separately by their owners; do not infer that all current diffs are part of this audit remediation.

## Current P1 Reconciliation (2026-10-18)

| ID / area | Status | Evidence | Classification |
|---|---|---|---|
| WR-GAME-001 Drawing authorization | Focused fixed | `backend/test/drawing_authorization.test.js`: 1/1; policy covers anonymous PUBLIC, owner PRIVATE, same-team TEAM, former/foreign team, gallery/detail/like/delete paths | FIXED in focused API tests; authenticated browser NOT TESTED; restart required before live browser retest |
| WR-RANK-001/002/003 Ranking | Focused fixed | Ranking/read-model set: 47/47 passed; stale projection reconciliation, empty season participant policy, date range helper, deterministic tie-break | FIXED in focused tests; historical event-time attribution remains a P2 review item |
| WR-AUTH-001/002/003 Auth/session/socket | Fixed | Auth/password/socket set: 21/21 passed; old access/refresh rejection, logout socket eviction, password-change replacement credentials and initiating-session continuity | FIXED in focused tests |
| WR-GAME-003 and timeout finalization | Fixed | Drawing/typing set: 12/12 passed; server duration, monotonic progress, timeout settlement and deterministic winner eligibility | FIXED in focused tests |
| WR-OPS-001/002 Admin Operations | Focused fixed | `operations-ownership.spec.js`: 2/2 passed using mocked API/auth boundary; unknown/partial responses remain visible | FIXED at mocked UI contract level; authenticated authorization NOT TESTED |
| Authenticated protected routes | Blocked | No safe fixture credentials or isolated seeded browser database available; mocked auth is excluded as authorization evidence | NOT TESTED / ENVIRONMENTAL |

## Full Regression Reconciliation

- Full backend command `npm test`: **701 tests, 688 passed, 12 failed, 1 skipped**. Failures are in pre-existing/non-P1 concurrency, Capital Board, malformed-event RBAC expectations, MVP race handling, and SQLite teardown/transaction behavior. This is **STILL FAILING** for release gating, even where unrelated to the five P1 fixes.
- Full frontend Playwright command `npm --prefix frontend run test:e2e`: **FAILED**. The build completed with existing Friends duplicate-key and CSS `@media` warnings; public-data ownership cases timed out, and the suite output contained mock-socket activity. This is **STILL FAILING / NOT AUTHORIZATION PROOF**.
- Frontend static checks: check PASS, route smoke 20/20 PASS, production build PASS with warnings.
- Focused ranking, auth/socket, drawing, typing, and Admin Operations tests passed as recorded above.


- `npm run dev`: frontend/backend started successfully.
- `GET /api/health`: 200, database `ok`.
- `npm --prefix frontend run check`: PASS, 126 files, 0 errors.
- `npm --prefix frontend run test:routes`: PASS, 20/20.
- `npm --prefix frontend run build`: PASS with warnings:
  - duplicate object properties in `frontend/src/pages/Friends.jsx` around lines 801–813;
  - CSS minifier `Unexpected "@media"` warning; source braces are balanced and warning appears parser/source-map related.
- Chromium public homepage/login desktop and 390px mobile smoke: rendered without console/page/request errors.
- Protected route crawl without authentication: redirected to `/login` as designed.

### Historical evidence, not current acceptance

The 2026-10-17 report recorded:

- MySQL backend suite: 553/599 passed, 38 failed, 8 cancelled.
- SQLite backend suite: 42/600 passed, 283 failed, 275 cancelled.
- Playwright: 158/172 passed, 14 failed.
- Frontend check: 115 files passed.
- Route smoke: 20/20 passed.

Phase 1/2 remediation reports claim fixes for several historical P1s, but those claims require current-tree reruns before release acceptance.

## Browser Verification

### Verified today

- Public `/` at desktop 1440px: rendered public spotlight, leaderboard, YouTube, and drawing sections.
- Public `/` at 390px: no horizontal overflow; no browser errors.
- `/login` at desktop/mobile: Google login CTA and public recognition panel rendered; no browser errors.
- Backend API health and public/catalog probes returned expected responses.

### Not verified today

- Authenticated Dashboard, YouTube, Leaderboard, Arena, Grand, Friends, Settings, Admin, and gameplay interactions.
- Two-account ownership, concurrency, reconnect, and scoring scenarios.
- Production Google OAuth, YouTube quota, Render keep-alive, real device/screen-reader behavior.

## Desktop / Mobile Verification

| Viewport | Surface | Result |
|---|---|---|
| 1440px | Home/Login | PASS smoke |
| 390px | Home/Login | PASS smoke; no overflow |
| 1920/1280/1024/768/430px | Protected product | NOT TESTED in current authenticated browser pass |

The known mobile header defect must be verified after remediation: authenticated <=640px currently hides notification/settings controls.

## Deployment / Rollback / Monitoring Plan

1. Apply DB migrations in a separate release step; verify schema before starting workers.
2. Deploy backend with workers enabled and confirm competition/outbox heartbeat timestamps.
3. Run health/readiness probes and a synthetic pending-event test.
4. Run authorization and scoring smoke tests against a non-production database.
5. Deploy frontend only after API response contract tests pass.
6. Monitor failed/pending event age, worker heartbeat, auth revocations, drawing access denials, typing score anomalies, and ranking projection drift.
7. Roll back frontend independently if UI contract fails; roll back backend only with migration compatibility and event replay plan.
8. Never run destructive test teardown against a production-like database.

## Remaining Risks

- Full current-tree backend and Playwright suites have not been rerun.
- Authentication is required to complete the browser audit; no credentials were supplied.
- Historical remediation status may differ from this broad uncommitted working tree.
- Tournament bracket domain is absent or not discoverable, so lifecycle coverage is incomplete.
- CSS/build warnings remain until independently corrected and rebuilt.

## Final Gate

| Gate | Status |
|---|---|
| P0 | PASS — none proven |
| P1 remediation | FAIL — multiple open/current residuals |
| Data correctness | FAIL |
| Permissions/privacy | FAIL |
| Realtime/scoring | FAIL |
| Frontend check/build | CONDITIONAL — commands pass, warnings remain |
| Full regression | FAIL — backend 688/701 with 12 failures; Playwright failed/timeouts |
| Browser regression | HOLD — public smoke only; authenticated protected-route coverage blocked |
| Release | **NO-GO** |

## Required Exit Criteria

The release may move from NO-GO to CONDITIONAL only when:

1. All P1 findings have a failing-before/fixed-after automated test or reproducible browser/API evidence.
2. Drawing privacy, access-token revocation, password-change session behavior, operations health, ranking ranges/projections, and typing timing/winner order are fixed and independently reviewed.
3. Full backend and frontend/E2E suites run on the current tree with failures triaged.
4. Authenticated browser crawl covers all major routes at desktop and mobile widths.
5. Build warnings are either fixed or documented with a verified no-impact rationale.
6. The final report is updated with exact counts of routes/pages/controls exercised, fixes applied, and remaining issues.
