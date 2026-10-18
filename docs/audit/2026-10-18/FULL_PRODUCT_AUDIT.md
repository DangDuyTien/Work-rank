# WorkRank — Full Product Audit

**Audit date:** 2026-10-18 (Asia/Ho_Chi_Minh)
**Repository:** `/Applications/du-an/workrank/workrank-realtime`
**Audit mode:** source review, running-app smoke, route inventory, API probes, build/check verification, specialist read-only audits
**Release decision:** **HOLD / NO-GO**

> This report distinguishes evidence collected on 2026-10-18 from historical claims in `docs/audit/2026-10-17/`. Historical PASS claims were not treated as current acceptance without rerunning them against the current working tree.

## Executive Summary

The product starts successfully in the local environment:

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:5001/`
- Backend health: `GET /api/health` returned HTTP 200 with `database: "ok"`.
- Public homepage and login were opened in Chromium at desktop and 390px mobile widths without browser console errors or failed requests.
- `npm --prefix frontend run check`: PASS (126 source files scanned, 0 errors).
- `npm --prefix frontend run test:routes`: PASS (20/20 route components).
- `npm --prefix frontend run build`: PASS, but emitted duplicate-object-property warnings in `Friends.jsx` and a CSS minifier `@media` warning.

The application remains under release hold. The P1 remediation pass fixed and focused-tested drawing authorization, ranking timeframe/projection reconciliation, token/socket revocation, server-authoritative typing settlement, and Admin Operations unknown-state handling. Remaining release concerns are authenticated browser coverage, full-suite failures, and broader non-P1 findings. The most material current results are:

1. Drawing visibility policy is now enforced in service/controller paths and passes the focused ownership matrix; a dev-server process captured before the controller fix still logged `isAdmin is not defined`, so the service must be restarted before browser retesting.
2. Ranking focused regressions pass, including deterministic ranges, participant snapshots, stale projection removal, and tie-break behavior.
3. Admin Operations focused Chromium coverage passes with mocked API/auth boundaries; this is not authorization proof.
4. Access/refresh/socket revocation focused suites pass, including logout invalidation and password-change session continuity.
5. Typing focused suites pass with server-observed duration and timeout settlement before winner selection.
6. Authenticated protected-route browser verification remains blocked because no safe fixture credentials and isolated seeded audit database were available.

## Product Route Inventory

### Public routes

| Route | Page/component | Reachability | Status |
|---|---|---:|---|
| `/` | `frontend/src/pages/Home.jsx` | Linked/public | Opens; public data loads |
| `/login` | `frontend/src/pages/Login.jsx` | Linked/public | Opens; Google CTA visible |
| `/auth/google/callback` | `Login.jsx` | Callback | Route exists |

### Protected routes

| Route | Page/component | Access |
|---|---|---|
| `/dashboard` | Dashboard | Authenticated |
| `/youtube` | YouTubeOverview | Authenticated |
| `/arena` | Arena | Authenticated |
| `/grand` | GrandHub | Authenticated |
| `/leaderboard` | Leaderboard | Authenticated |
| `/friends` | Friends | Authenticated |
| `/settings` | Settings | Authenticated |
| `/users/:id` | UserDetail | Authenticated |
| `/games` | GameHub | Authenticated |
| `/games/2048` | Game2048 | Authenticated |
| `/games/uno`, `/games/uno/room/:roomId` | UnoGame | Authenticated |
| `/games/quiz`, `/games/quiz/room/:roomId` | QuizGame | Authenticated |
| `/games/sam`, `/games/sam/room/:roomId` | SamGame | Authenticated |
| `/games/typing`, `/games/typing/room/:roomId`, `/games/typing/spectate/:roomId` | TypingBattle | Authenticated |
| `/games/drawing` | DrawingGame | Authenticated |

### Admin routes

`/admin/kpi`, `/admin/quiz`, `/admin/privileges`, `/admin/teams-youtube`, `/admin/competition/rules`, `/admin/competition/seasons`, `/admin/competition/grand`, and `/admin/operations` are protected by `AdminRoute`.

### Aliases and dead/legacy surfaces

- `/kpi`, `/activity`, `/tracking`, `/productivity` redirect to Dashboard.
- `/rankings`, `/activity-ranking`, `/activity-leaderboard` redirect/normalize to Leaderboard.
- `/groups` redirects to Friends; `Groups.jsx` remains as an unmounted component.
- `/games/guess` redirects to Quiz.
- `/games/capital-board` redirects to UNO, while navigation still labels it “Cờ Tỷ Phú”.
- `CapitalBoardGame.jsx` is lazy-imported but has no route.
- `CapitalBoardWaitingRoom.jsx` constructs `/games/capital-board/room/:id`, which has no matching route and falls through the wildcard redirect.
- Unknown routes redirect to `/`; there is no dedicated 404 state.

## Coverage Matrix

| Area | Source audit | Running app | Current result |
|---|---:|---:|---|
| Dashboard/YouTube/analytics | Yes | Public/home only; protected flows not authenticated | Open data correctness issues |
| Ranking/competition | Yes | Not authenticated | Open high-severity data issues |
| Collaboration/social | Yes | Not authenticated | Open identity, relationship, and read-state issues |
| Games | Yes | Public route gate only; no authenticated gameplay | Open privacy, persistence, and scoring issues |
| Account/settings/global UX | Yes | Login/public + mobile shell smoke | Open mobile, auth, settings, and navigation issues |
| Responsive | 390px public/login smoke | 390px homepage/login | Protected-page responsive audit not rerun today |
| Realtime/socket | Source review | Backend started; no authenticated gameplay session | Not fully tested |
| Browser console/network | Public homepage/login | Chromium | No errors on tested public surfaces |
| Tournament brackets | Source inventory | Not tested | No standalone bracket/match domain route/model found |

**Routes declared in `frontend/src/App.jsx`:** 45 declarations including aliases, dynamic routes, and wildcard. **Frontend JS/JSX files:** 126. **Specialist browser interaction:** not available for authenticated pages because no test account/session was supplied in this audit turn.

## Issue Summary

The historical 2026-10-17 baseline contains **23 issues: P0=0, P1=13, P2=9, P3=1**. The current specialist review adds current-tree findings and residuals; these are not silently counted as fixed by historical remediation reports.

### Current specialist findings

| Severity | Count | Examples |
|---|---:|---|
| P0 | 0 | No P0 was proven |
| P1/high | 12+ | Drawing privacy, ranking range/projection errors, operations false health, auth revocation, YouTube period/freshness, typing scoring |
| P2/medium | 16+ | Social races/read state, 2048 active sessions, responsive/accessibility, chart labels, stale routes |
| P3/low | 4+ | Dead footer labels, lightbox polish, duplicate-key resilience, documentation/harness cleanup |

Counts above intentionally overlap with historical issues when a residual or current-tree regression is the same root problem. The canonical historical count remains 23; current findings must be tracked by their specialist IDs below.

## Issues By Area

### Dashboard / YouTube / Analytics

- **WR-DASH-001 — P1:** Mixed successful/failed YouTube channel syncs can be reported as FRESH/STALE instead of FAILED. `backend/src/services/youtube/youtubeAggregation.service.js:443-450,503-509`; UI `frontend/src/pages/YouTubeOverview.jsx:255-262`.
- **WR-DASH-002 — P1:** Team “Top theo lượt xem” cards show subscribers as supporting value, misleading the metric context. `frontend/src/pages/YouTubeOverview.jsx:326-350`.
- **WR-DASH-003 — P1:** Team detail accepts `period` but summary/growth data remains fixed to 30 days. `backend/src/services/youtube/youtubeAggregation.service.js:597-632`; UI labels 30 days at `YouTubeOverview.jsx:396-413`.
- **WR-DASH-004 — P2:** Short trend charts can render 7–9 x-axis labels despite claiming a maximum of six. `frontend/src/components/YouTubeTrendChart.jsx:109-119`.

### Ranking / Tournament

- **WR-RANK-001 — P1:** Daily/monthly/yearly leaderboard ranges use current-season totals instead of date-bounded ledger scores. `backend/src/services/dashboard.service.js:143-199`.
- **WR-RANK-002 — P1:** Projection rebuild upserts current rows but does not delete removed/disqualified entities. `backend/src/services/competition/competitionReadModel.projector.js:317-439`.
- **WR-RANK-003 — P1:** Empty season snapshots fall back to every platform team and can award points to unregistered teams. `backend/src/services/competition/season.service.js:261-334,615-636`.
- **WR-RANK-004 — P2:** “All-time” ranking uses `currentSeasonScore`. `backend/src/services/ranking/ranking.service.js:319-410`.
- **WR-RANK-005 — P2:** Weekly tie-break timestamp is overwritten on each positive score. `backend/src/services/ranking/weeklyRanking.js:10-22`.
- **WR-RANK-006 — P2:** Projection calculator reads outside the finalization transaction. `competitionReadModel.projector.js:317-324`.
- **WR-RANK-007 — P2:** Individual season ranking unions unregistered scorers and falls back to current team membership. `season.service.js:365-376,416-454`.
- **WR-RANK-008 — P2:** Team attribution through current `User.teamId` changes historical results after a member moves teams. `season.service.js:283-315`.
- No standalone tournament bracket/match route or competition bracket model was found; bracket behavior is **NOT TESTED / likely absent**.

### Collaboration / Social

- **WR-SOC-001 — P1:** Notifications can remain associated with user A when Layout persists through logout/login as user B. `frontend/src/components/Layout.jsx:82,147-187`.
- **WR-SOC-002 — P2:** Reciprocal friend requests can race into two directional rows. `backend/src/services/friend.service.js:115-138`; directional unique migration `20260516000300-create-friendships.js:41-44`.
- **WR-SOC-003 — P2:** Search renders chat actions for non-friends although backend rejects them with 403. `FriendsDock.jsx:365-370,648-663`; `chat.service.js:57-75`.
- **WR-SOC-004 — P2:** Kudos retries without a stable idempotency key can duplicate scoring and dual writes are not atomic. `competition.controller.js:807-850`; `communityIntegration.service.js:34-72`.
- **WR-SOC-005 — P2:** Inactive accounts remain in friends/request associations although chat rejects them. `friend.service.js:54-92`; `chat.service.js:64-68`.
- **WR-SOC-006 — P2:** Socket-only read marking has no acknowledgement timeout/HTTP fallback. `FriendsDock.jsx:205-213`; `sockets/index.js:106-117`.

### Games

- **WR-GAME-001 — P1:** Optional-auth drawing gallery/detail can expose TEAM/PRIVATE artwork without ownership/team checks. `backend/src/routes/drawing.routes.js:15-17`; `backend/src/services/drawing.service.js:137-143,209-214`.
- **WR-GAME-002 — P2:** 2048 permits multiple ACTIVE sessions per user; stale sessions remain checkpointable/submittable. `backend/src/services/game2048.service.js:76-94,120-153,220-265`.
- **WR-GAME-003 — P1:** Typing Battle trusts client-provided duration for WPM and ranking. `backend/src/services/typingGame.service.js:748-755,802-820`; socket payload handling `backend/src/sockets/index.js:482-490`.
- **WR-GAME-004 — P2:** Typing completion formula can accept approximately 80% of text while awarding completion. `typingGame.service.js:824-848`.
- **Current-tree regression — P1:** `finalizeMatch` chooses eligible winner before converting timed-out players and calculating their final score. `typingGame.service.js:914-970`.

### Account / Settings / Global UX

- **WR-UX-001 — P1/P2:** At <=640px `.app-icon-action` hides notification/settings controls with no mobile replacement. `frontend/src/index.css:4936-4940`; `Layout.jsx:405-594`.
- **WR-UX-002 — P2:** Appearance changes are read only on Layout mount and require reload. `Settings.jsx:304-312`; `Layout.jsx:119-131`.
- **WR-UX-003 — P2:** Auth notices are written to session storage but Login does not consume them. `AuthContext.jsx:66,138-142,227,253`; `Login.jsx:88-90`.
- **WR-UX-004 — P2:** Competition notification preference is not consulted before storing notifications. `Settings.jsx:1010-1024`; `Layout.jsx:147-187`.
- **WR-UX-005 — P2:** Cờ Tỷ Phú navigation redirects to UNO and has stale title mapping. `navigation.js:136-142,327`; `App.jsx:200`.
- **WR-UX-006 — P3:** Removing local avatar does not clear current profile state. `Settings.jsx:428-431,480-488`.
- **WR-UX-007 — P3:** Profile lightbox lacks Escape, dialog semantics, and focus management. `UserDetail.jsx:1183-1275`.
- **WR-UX-008 — P3:** Privacy/terms/API footer labels are non-interactive spans. `Layout.jsx:701-721`.
- **WR-UX-009 — P2:** Invalid `/users/foo` becomes `/api/users/NaN`. `UserDetail.jsx:136,221`.

### Auth / Operations / Trust

- **WR-AUTH-001 — P1:** Password change increments `tokenVersion` only for refresh validation; old access tokens remain accepted. `backend/src/utils/token.js:5-18`; `backend/src/middlewares/auth.middleware.js:13-17`; `auth.service.js:146-150`.
- **WR-AUTH-002 — P1:** Password-change revocation event disconnects the initiating browser, which clears user state before returned fresh tokens are stored. `auth.service.js:154-170`; `AuthContext.jsx:221-228`; `api.js:388-393`.
- **WR-AUTH-003 — P2:** Logout does not increment `tokenVersion`; copied refresh tokens remain usable if global revocation is intended. `auth.service.js:103-123`.
- **WR-OPS-001 — P1:** Admin operations shows optimistic health when APIs fail or fields are null: `HOẠT ĐỘNG`, `ONLINE`, `KẾT NỐI`, `100%`, `Vừa xong`, and `Đồng bộ 100%`. `frontend/src/pages/AdminOperations.jsx:124-130,362-369,422-440,452-509`.
- **WR-OPS-002 — P1:** Admin Operations expects `integrationHealth.events/outbox`, while backend returns them under `summary`; counts default to zero/healthy. `AdminOperations.jsx:292,390-405`; `competitionIntegrationMonitor.service.js:117-138`.
- **WR-OPS-003 — P2:** Projection UI expects fields absent from backend `tableStats`, displaying zeros. `AdminOperations.jsx:515-527`; `competitionAnalytics.service.js:160-195`.

## Data Accuracy Findings

Data cannot currently be considered trustworthy for all ranking and YouTube periods. The most material sources are:

- selected range not applied to daily/monthly/yearly leaderboard totals;
- stale projection rows after membership/disqualification changes;
- unregistered teams included in empty seasons;
- current team membership used for historical attribution;
- YouTube mixed-failure freshness downgraded to a successful-looking state;
- requested YouTube team period not applied to summary cards;
- operations UI schema mismatch and optimistic fallbacks.

## UX Findings

Primary UX failures are misleading actions and unavailable controls rather than visual style alone:

- stale Capital Board entry leads to UNO;
- mobile authenticated users lose notification/settings actions;
- failed operational requests look healthy;
- non-friends receive a chat action that always fails;
- auth failure/logout reason is not shown after redirect;
- settings and notification preferences do not propagate to the shell;
- no dedicated 404 state;
- authenticated-page mobile and modal focus behavior remain unverified today.

## Logic / Permission Findings

- Drawing visibility is not enforced at detail/gallery boundaries.
- Typing duration and completion/winner calculations trust or order client-derived state incorrectly.
- Friend/kudos operations lack robust concurrency/idempotency boundaries.
- Token-version revocation is incomplete across access tokens, sockets, refresh tokens, and the initiating password-change session.
- 2048 now has cross-user ownership checks in source, but finalized-session state and multiple-active-session handling remain incomplete.

## Current Reconciliation

| Area | Result | Evidence / classification |
|---|---|---|
| Drawing authorization | Focused fixed | 1/1 ownership test; live browser still NOT TESTED and an earlier running process needs restart after controller fix |
| Ranking | Focused fixed | 47/47 focused ranking/read-model tests; full backend remains STILL FAILING |
| Auth/session/socket | Focused fixed | 21/21 targeted tests |
| Typing scoring/finalization | Focused fixed | 12/12 focused tests |
| Admin Operations | Focused fixed at UI contract boundary | 2/2 mocked E2E; mocked auth is not authorization evidence |
| Authenticated routes | NOT TESTED / ENVIRONMENTAL | No safe fixture credential plus isolated seeded audit DB |
| Full backend | STILL FAILING | 701 total, 688 pass, 12 fail, 1 skip |
| Full Playwright | STILL FAILING | Full command failed; public-data ownership tests timed out; build warnings remain |


| Command / action | Result |
|---|---|
| `npm run dev` | Backend/frontend started; workers logged startup |
| `GET http://127.0.0.1:5001/api/health` | HTTP 200, database ok |
| Public homepage Chromium desktop | HTTP 200, rendered public data, no console/page/request errors |
| Public homepage Chromium 390px | No horizontal overflow (`scrollWidth=clientWidth=390`), no browser errors |
| Login Chromium desktop/mobile | Rendered Google login CTA, no browser errors |
| Protected route crawl without auth | All tested protected paths redirected to `/login`; gameplay not assessed |
| `npm --prefix frontend run check` | PASS, 126 files, 0 errors |
| `npm --prefix frontend run test:routes` | PASS, 20/20 |
| `npm --prefix frontend run build` | PASS with Friends duplicate-property and CSS minifier warnings |
| Representative API probes | Dashboard unauthenticated 401; games catalog/public spotlight 200 |

## Dead / Duplicate Feature Inventory

| Surface | Decision | Evidence |
|---|---|---|
| Capital Board route/navigation | REMOVE or restore coherently | Route redirects to UNO; imported page is unreachable; room URL unmatched |
| Groups page | MERGE/archive after consumer check | `/groups` redirects to `/friends`; component is not directly routed |
| Admin Operations health fields | FIX, not remove | Useful operational surface, but contract/schema and unknown states are wrong |
| YouTube period controls | FIX | Useful feature with incorrect period semantics |
| Footer legal/API labels | ADD real destinations or REMOVE | Current spans are dead UI |
| 404 route | ADD contextual 404 | Current wildcard redirects every unknown path to home |

## NOT TESTED / Limitations

- Authenticated browser interaction for Dashboard, YouTube, Ranking, Tournament, Social, Settings, Admin, and games; no test credentials/session were supplied in this audit turn.
- Real two-account concurrent friend/kudos/chat tests.
- Real private/team drawing access test against a production-like account.
- Full Playwright suite, backend full suite, MySQL migration/seed suite, screen reader, keyboard traversal, actual devices, slow network, websocket reconnect, soak, Core Web Vitals, and performance/FPS.
- Production deployment, third-party Google OAuth, YouTube quota/freshness, and external Render health behavior.
- Standalone tournament bracket progression/results because no domain route/model was found.

## Final Gate

| Gate | Status | Reason |
|---|---|---|
| Dashboard | HOLD | YouTube freshness/period issues; authenticated browser not rerun |
| YouTube data | FAIL | Mixed failure and period semantics can mislead users |
| Ranking | FAIL | Range, projection, registration, and historical attribution errors |
| Tournament | HOLD/FAIL | Lifecycle source exists; bracket domain not found/tested |
| Collaboration | FAIL | Notification identity leak, race/idempotency/read-state issues |
| Games | FAIL | Drawing privacy and typing scoring defects |
| Account | FAIL | Incomplete token revocation and password-change session behavior |
| Settings | HOLD | Persistence/notification preference issues |
| Responsive | HOLD | Public mobile passed; protected-page mobile not verified |
| Global UI consistency | HOLD | Dead navigation and mobile controls remain |
| Data correctness | FAIL | Ranking/YouTube/operations data can be wrong or falsely healthy |
| Regression | HOLD | Targeted frontend checks pass; full current-tree regression not rerun |

**Overall:** **NO-GO until P1 findings are fixed and current-tree full regression/browser verification is rerun.**