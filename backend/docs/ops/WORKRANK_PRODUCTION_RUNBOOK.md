# WORKRANK V3.3 — PRODUCTION OPERATIONAL RUNBOOK

> **Version:** WorkRank V3.3 Enterprise Edition  
> **Target Audience:** DevOps, Site Reliability Engineers (SRE), Platform Administrators  
> **Last Updated:** 2026-09-29  

---

## 1. System Architecture & Startup Procedures

WorkRank V3.3 runs on Node.js (v20+), MySQL / PostgreSQL (Sequelize), and Redis (optional / socket clustering).

### 1.1. Startup Sequence
1. **Pre-flight Configuration Verification:**
   ```bash
   NODE_ENV=production npm run start
   ```
   *System will fail-fast if `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CLIENT_URL` or `DATABASE_URL` are insecure or missing.*
2. **Database Migration Verification:**
   ```bash
   npm run db:migrate
   ```
   *Ensures all 21 deterministic schema migrations are applied.*
3. **Competition Worker Launch:**
   The competition engine worker automatically polls every `ENGINE_POLL_INTERVAL_MS` (default 3000ms) with batch size `ENGINE_BATCH_SIZE` (default 50).

---

## 2. Health Probes & Monitoring

Kubernetes and load balancers should be configured with the following HTTP probes:

| Probe | Endpoint | Expected Code | Fail Action |
| :--- | :--- | :--- | :--- |
| **Liveness** | `GET /health/live` | 200 OK | Restart container (unresponsive process) |
| **Readiness** | `GET /health/ready` | 200 OK | Remove container from traffic pool (DB down) |
| **Public Stats** | `GET /health` | 200 OK | Operational metrics & uptime |
| **Integration Monitor** | `GET /api/competition/admin/integration/health` | 200 OK (Admin) | Alerts on DLQ backlog or error spikes |

---

## 3. Operational Controls & Emergency Switches

### 3.1. Emergency Scoring Kill Switch (Pause Competition Scoring)
If an incorrect rule is published or high scoring anomalies are observed:
- **Action:** Set environment variable `COMPETITION_PROCESSING_ENABLED=false` or invoke `competitionEngineWorker.setProcessingEnabled(false)`.
- **Behavior:**
  - Product actions (`production`, `youtube`, `community`) continue to function normally.
  - Domain events continue to be safely collected in `competition_events` (Status: `PENDING`).
  - Worker skips scoring evaluation. **No events are dropped or deleted.**
- **Resumption:** Set `COMPETITION_PROCESSING_ENABLED=true`. Worker immediately catches up on pending backlog.

### 3.2. Shadow Mode Activation
To test real event ingestion without mutating user/team scores:
- **Action:** Set `COMPETITION_SHADOW_MODE=true` or invoke `competitionEngineWorker.setShadowModeEnabled(true)`.
- **Behavior:** Worker evaluates AST rules, records expected effects in event metadata, logs trace, but bypasses `ScoreLedger` and state mutations.

---

## 4. Operational Maintenance & Diagnostic Procedures

### 4.1. Dead-Letter Queue (DLQ) Inspection & Manual Retry
When an event transitions to `FAILED` (quarantined):
1. **Inspect Failed Events:**
   ```http
   GET /api/competition/admin/integration/health
   Authorization: Bearer <ADMIN_TOKEN>
   ```
2. **Review Event Trace:**
   ```http
   GET /api/competition/events/:eventId/trace
   Authorization: Bearer <ADMIN_TOKEN>
   ```
3. **Trigger Manual Retry (Mandatory Reason):**
   ```http
   POST /api/competition/admin/events/:eventId/retry
   Authorization: Bearer <ADMIN_TOKEN>
   Content-Type: application/json

   { "reason": "Evaluator patched and verified in staging" }
   ```

### 4.2. Materialized Read Model Rebuild Drill
If read model projections become desynchronized:
```http
POST /api/competition/admin/projections/rebuild
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{ "reason": "Post-maintenance projection synchronization" }
```
*The system replays the immutable Event Store source-of-truth and refreshes `CompetitionUserSummary`, `SeasonLeaderboardProjection`, and `GrandLeaderboardProjection` in $< 1\text{ second}$.*
