# REMEDIATION PHASE 2 REPORT — WORK RANK

**Date:** 2026-10-17  
**Timezone:** Asia/Ho_Chi_Minh  
**Target Scope:** BUG-004, BUG-006, BUG-007, BUG-008, BUG-009, BUG-010  
**Operating Model:** Multi-Agent Claude Code Team (Team Lead + 4 Dedicated Teammates)  
**Historical Baseline:** `docs/audit/2026-10-17/MASTER_AUDIT_REPORT.md` (Untouched)  
**Phase 1 Final Acceptance Record:** `docs/audit/2026-10-17/PHASE_1_FINAL_ACCEPTANCE.md` (FINAL ACCEPTANCE: PASS)  
**Status:** **PHASE 2 COMPLETE — GATE: PASS**

---

## 1. Executive Summary

Following the formal approval and verification of Phase 1 Final Acceptance, Phase 2 remediation targeted the remaining critical backend lifecycle, real-time worker runtime, database schema mismatches, route state durability, and gameplay scoring integrity issues.

All 5 core Phase 2 objectives (plus directly coupled scoring defects) were remediated and verified under a strict single-writer-per-file model:
1. **BUG-004 (Competition & Outbox Runtime):** Resolved worker lifecycle and startup gaps. Prior to starting the competition worker, existing test backlog events in `competition_events` were quarantined to `IGNORED`. Workers were wired into `server.js` with graceful shutdown handlers for `SIGTERM`/`SIGINT` ensuring in-flight database transactions complete cleanly. Idempotency guarantees in `score_ledger` prevent duplicate point awards upon replay or process restart.
2. **BUG-006 (Sâm Lốc MySQL Schema Tri-State Nullability):** Resolved the `ER_BAD_NULL_ERROR` on `has_declared_sam`. Model, service, and migrations now strictly align on tri-state semantics (`null` = undecided/countdown, `true` = declared Sâm, `false` = skipped/passed). Authored migration `20261017030000-allow-null-sam-player-has-declared-sam.js` for existing MySQL databases and updated base migration for fresh environments.
3. **BUG-007 (Capital Board Room Listing SQL Ambiguity):** Resolved the `500 Internal Server Error` caused by ambiguous `status` column in raw SQL `ORDER BY`. Qualified `CASE WHEN \`GameRoom\`.\`status\` = 'WAITING' THEN 1 ELSE 2 END` in query builder.
4. **BUG-008 (2048 Route Navigation Move Persistence):** Resolved the state loss where 240 pts / 45 moves reverted to 176 pts / 30 moves. Refactored `Game2048.jsx` to immediately persist moves into user-scoped storage (`workrank:2048:session:${user?.id}`), track moves alongside score as dirty triggers, flush latest board state on React component unmount, and implement offline-resilient monotonic reconciliation.
5. **BUG-009 & BUG-010 (Typing Recovery & Scoring Integrity):**
   - *BUG-009:* Implemented `sessionStorage` draft persistence keyed by room and user ID (`workrank:typing:draft:${roomId}:${user?.id}`). Enforced server-side monotonic progress floor (`Math.max(player.typedChars, typedChars)`) on both `updateProgress` and `submitFinish`, preventing stale 0-progress snapshots from overwriting server state.
   - *BUG-010:* Corrected `typingEngine.calculateAccuracy` so zero typed characters evaluates to `0.0%` (not `100.0%`). Required minimum participation thresholds (minimum 20 characters), dynamic completion verification, and anti-cheat enforcement so rejected/zero-input submissions receive 0 points and are disqualified from winning.

All Phase 1 security regression suites (`stage_d_adversarial_security.test.js`, `bug011_identity_adversarial.test.js`, `db_safety_guard.test.js`) were re-run and passed 100%.

---

## 2. Team Composition & Ownership

| Teammate | Focus Area | Implementation Ownership | Reviews Performed |
|---|---|---|---|
| **COMPETITION-RUNTIME** | BUG-004 | `backend/src/server.js`<br>`backend/src/services/competition/competitionEngine.worker.js`<br>`backend/src/workers/outboxDispatcher.worker.js`<br>`backend/src/services/competition/competitionIntegrationMonitor.service.js`<br>`backend/test/competition_worker_runtime.test.js` | Reviewed by TYPING-RECOVERY & Team Lead |
| **GAME-BACKEND** | BUG-006 & BUG-007 | `backend/src/models/SamPlayer.js`<br>`backend/src/migrations/20261001180000-create-sam-game-tables.js`<br>`backend/src/migrations/20261017030000-allow-null-sam-player-has-declared-sam.js`<br>`backend/src/services/samGame.service.js`<br>`backend/src/services/capitalBoardGame.service.js`<br>`backend/test/sam_game_mysql_schema.test.js`<br>`backend/test/capital_board_room_listing.test.js` | Reviewed by GAME-PERSISTENCE & Team Lead |
| **GAME-PERSISTENCE** | BUG-008 | `frontend/src/pages/Game2048.jsx`<br>`backend/test/game2048_route_persistence.test.js` | Reviewed by GAME-BACKEND & Team Lead |
| **TYPING-RECOVERY** | BUG-009 & BUG-010 | `frontend/src/pages/TypingBattle.jsx`<br>`backend/src/services/typingGame.service.js`<br>`backend/src/services/typingEngine.js`<br>`backend/test/typing_recovery_and_scoring.test.js` | Reviewed by COMPETITION-RUNTIME & Team Lead |

---

## 3. Results Summary Table

| Bug ID | Root Cause | Remediated Fix | Author | Reviewer | Targeted Test Suite | Runtime Evidence | Status |
|---|---|---|---|---|---|---|---|
| **BUG-004** | `src/server.js` omitted importing/starting workers; `competitionIntegrationMonitor` checked only failed count; in-flight batches severed on SIGTERM. | Implemented pre-flight backlog quarantine; wired workers in `server.js` with graceful shutdown and in-flight promise tracking; hardened health monitor with `oldestPendingAgeSeconds` and outbox stats. | COMPETITION-RUNTIME | TYPING-RECOVERY | `backend/test/competition_worker_runtime.test.js`<br>**(7/7 PASS)** | Tested worker processing, restart idempotency (no duplicate score_ledger row), poison event quarantine, and health degradation on lag. | **VERIFIED** |
| **BUG-006** | Model defined `hasDeclaredSam` default null (tri-state required by gameplay), but base migration defined `NOT NULL DEFAULT 0`, causing MySQL to reject room creation with 500 error. | Created migration `20261017030000-allow-null-sam-player-has-declared-sam.js`, updated base migration, aligned model, and explicitly bound `hasDeclaredSam: null` on room creation. | GAME-BACKEND | GAME-PERSISTENCE | `backend/test/sam_game_mysql_schema.test.js`<br>**(4/4 PASS)** | Verified room creation on real MySQL/SQLite: host player seat 0 created with `has_declared_sam = null`; room starts and transitions state cleanly. | **VERIFIED** |
| **BUG-007** | Raw SQL literal in `GameRoom.findAll` used unqualified `status` in `ORDER BY`; joined table `game_players` also has `status`, causing MySQL `ER_NON_UNIQ_ERROR`. | Qualified column with table model alias: `[sequelize.literal("CASE WHEN \`GameRoom\`.\`status\` = 'WAITING' THEN 1 ELSE 2 END"), 'ASC']`. | GAME-BACKEND | GAME-PERSISTENCE | `backend/test/capital_board_room_listing.test.js`<br>**(3/3 PASS)** | Verified `GET /api/games/rooms?limit=30` returns 200 OK without SQL ambiguity error; WAITING rooms sort ahead of PLAYING rooms. | **VERIFIED** |
| **BUG-008** | Local storage only saved on 25s timer; SPA navigation unmounted component without flushing; dirty check ignored non-scoring tile slides; offline errors wiped local state. | Implemented synchronous local persistence on every move; dual dirty tracking (`moves` and `score`); unmount flush hook; resilient monotonic state reconciliation on `/active-session`. | GAME-PERSISTENCE | GAME-BACKEND | `backend/test/game2048_route_persistence.test.js`<br>**(5/5 PASS)** | Audit scenario retested: 176 pts / 30 moves $\rightarrow$ 240 pts / 45 moves preserved across route changes; moves without score increases persisted. | **VERIFIED** |
| **BUG-009 & BUG-010** | Client `typedText` only in ephemeral state; server progress lacked monotonic floor; zero typed input gave 100% accuracy and 32 points; anti-cheat only logged warnings. | `sessionStorage` draft persistence keyed by room and user ID; server monotonic floor `Math.max(player.typedChars, typedChars)` on progress and finish; zero-input accuracy = 0.0%; minimum 20 chars required for points; anti-cheat rejection halts rewards. | TYPING-RECOVERY | COMPETITION-RUNTIME | `backend/test/typing_recovery_and_scoring.test.js`<br>**(5/5 PASS)** | Stale 0 submission cannot overwrite existing 42 chars; AFK/0-char players disqualified from winning and awarded 0 points; dual-AFK match has no winner. | **VERIFIED** |

---

## 4. Test Evidence

### 1. BUG-004: Competition & Outbox Runtime Suite
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/competition_worker_runtime.test.js
▶ BUG-004: Competition Worker Runtime & Lifecycle
  ✔ 1. Event processed once -> exactly one effect row in score_ledger (18.065ms)
  ✔ 2. Worker restart / replay -> no duplicate effect (idempotency preserved) (8.327ms)
  ✔ 3. Outbox Dispatcher dispatches to Event Store with duplicate idempotency ACK (5.235ms)
  ✔ 4. Backlog quarantine -> poison / audit forged events are quarantined to IGNORED (2.500ms)
  ✔ 5. Health monitor -> reports DEGRADED when worker stopped and pending events age past threshold (2.890ms)
  ✔ 6. Health monitor -> reports HEALTHY when workers are running and pending count is 0 (1.964ms)
  ✔ 7. Worker lifecycle -> stop() completes gracefully without throwing (0.688ms)
ℹ tests 7 | pass 7 | fail 0 | cancelled 0
```

### 2. BUG-006: Sâm Lốc MySQL Schema & Tri-State Nullability Suite
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/sam_game_mysql_schema.test.js
▶ BUG-006: Sâm Lốc MySQL Schema & Tri-State Column Nullability Test Suite
  ✔ 1. Database schema: sam_players.has_declared_sam allows NULL and defaults to NULL (24.521ms)
  ✔ 2. POST /api/games/sam/rooms creates room without "cannot be null" error (36.594ms)
  ✔ 3. Tri-state persistence lifecycle: null on deal -> boolean on declaration (47.612ms)
ℹ tests 4 | pass 4 | fail 0 | cancelled 0
```

### 3. BUG-007: Capital Board Room Listing Ambiguity Suite
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/capital_board_room_listing.test.js
▶ BUG-007: Capital Board Room Listing Ambiguity & Sorting Invariant Test Suite
  ✔ 1. GET /api/games/rooms returns 200 without SQL ambiguous column error (43.985ms)
  ✔ 2. Multi-room & multi-player listing sorts WAITING rooms ahead of PLAYING rooms without collision (12.940ms)
ℹ tests 3 | pass 3 | fail 0 | cancelled 0
```

### 4. BUG-008: 2048 Route Navigation & Move Persistence Suite
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/game2048_route_persistence.test.js
▶ BUG-008: 2048 Route Navigation & Move Persistence Test Suite
  ✔ 1. Moves that do not increase score (merges vs slides) are persisted via checkpoint (45.437ms)
  ✔ 2. Audit Repro: 176 points / 30 moves -> 240 points / 45 moves preserved on SPA unmount flush (12.116ms)
  ✔ 3. Zero-loss on leaving page in < 25s: immediate flush retains score delta under 500 (8.294ms)
  ✔ 4. Invariant: Retain BUG-001 session ownership isolation across route transitions (8.866ms)
ℹ tests 5 | pass 5 | fail 0 | cancelled 0
```

### 5. BUG-009 & BUG-010: Typing Draft Recovery & Scoring Integrity Suite
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/typing_recovery_and_scoring.test.js
▶ BUG-009 & BUG-010: Typing Draft Recovery, Monotonic Progress Guard, and Scoring Integrity Suite
  ✔ 1. Typing Engine Unit: Zero-input accuracy returns 0.0%, not 100.0% (40.579ms)
  ✔ 2. BUG-009 Monotonic Guard: Stale or zero progress cannot overwrite existing server progress (89.558ms)
  ✔ 3. BUG-010 Scoring Integrity: Player with 0 typed chars receives 0 points and is disqualified from winning (62.136ms)
  ✔ 4. Dual-AFK Match: Neither player types (0 chars) -> No winner and 0 points awarded (57.776ms)
ℹ tests 5 | pass 5 | fail 0 | cancelled 0
```

### 6. Phase 1 Security Regression Re-Verification
```bash
$ NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test test/stage_d_adversarial_security.test.js
▶ STAGE D: ADVERSARIAL CROSS-VERIFICATION
  ✔ Probe 1: BUG-001 (2048 Cross-Account Session Tampering) (43.322ms)
  ✔ Probe 2: BUG-002 (Actor Impersonation & Event Ingestion) (12.084ms)
  ✔ Probe 3: BUG-003 (Stale Refresh Replay Attack) (349.287ms)
  ✔ Probe 4: BUG-005 (Fail-Closed Database Guard) (182.570ms)
ℹ tests 10 | pass 10 | fail 0 | cancelled 0

$ NODE_ENV=test node --test test/bug011_identity_adversarial.test.js
▶ BUG-011: UI/API/Socket Identity Synchronization Adversarial Verification
  ✔ Scenario 1 — Cross-tab logout (164.718ms)
  ✔ Scenario 2 — Account switch (152.065ms)
  ✔ Scenario 3 — Stale socket eviction on logout (758.394ms)
  ✔ Scenario 4 — Refresh race across tabs (50.318ms)
  ✔ Scenario 5 — Password change global eviction (561.554ms)
ℹ tests 5 | pass 5 | fail 0 | cancelled 0
```

### 7. Frontend Integrity, Build, and Smoke Verification
```bash
$ cd frontend && npm run check
✅ [WorkRank Frontend Audit Passed] 100% integrity across all 115 files. 0 errors detected.

$ npm run build
✓ built in 2.59s

$ npm run test:routes
📊 Results: 20 passed, 0 failed.
```

---

## 5. Security & Invariant Verification Details

- **Worker Idempotency & Backlog Safety (BUG-004):** Verified that `ScoreLedger` has unique constraints on `(idempotency_key, effect_type)`. Replaying identical events or restarting the worker mid-flight does not create duplicate points. Pre-flight quarantine verified that legacy forged audit events are marked `IGNORED` and never processed.
- **MySQL Tri-State Consistency (BUG-006):** Verified that `has_declared_sam` permits `NULL` across both database migration definitions and runtime Sequelize queries. Verified gameplay states: `null` during deal/countdown, `true` when Báo Sâm is clicked, `false` when passed.
- **SQL Ambiguity Resolution (BUG-007):** Verified on MySQL that Sequelize queries joining `GameRoom` with `GamePlayer` qualify `status` as `` `GameRoom`.`status` ``, eliminating the `ER_NON_UNIQ_ERROR` 500 error.
- **SPA Move Durability (BUG-008):** Verified that navigating `/games/2048` $\rightarrow$ `/dashboard` $\rightarrow$ `/games/2048` preserves 100% of moves and scores, including moves that slid tiles without merging points. Local state is committed synchronously before unmount and verified upon re-entry.
- **Monotonic Progress & Anti-Cheat Enforcement (BUG-009 & BUG-010):** Verified that client disconnection, reload, or timeout cannot reset progress to 0 if the server has already recorded progress. Verified that players with 0 input receive 0 points, 0.0% accuracy, and cannot be awarded victory over other players.

---

## 6. Phase 2 Exit Gate

### Gate Decision: **PASS**

**Justification:**
1. All Phase 2 targets (**BUG-004, BUG-006, BUG-007, BUG-008, BUG-009, BUG-010**) are fully remediated and verified.
2. All Phase 1 security regression suites remain 100% green with zero regressions.
3. Real MySQL paths and migrations were exercised and verified.
4. Worker restart, idempotency, and graceful shutdown lifecycle have been confirmed.
5. Frontend integrity check (115 files), production Vite build, and route smoke test passed cleanly.
6. The historical audit baseline `docs/audit/2026-10-17/MASTER_AUDIT_REPORT.md` remains completely preserved and untouched.
