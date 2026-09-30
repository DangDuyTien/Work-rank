# WORKRANK V3.3 — INCIDENT HANDLING & RECOVERY RUNBOOK

> **Version:** WorkRank V3.3 Enterprise Edition  
> **Classification:** SRE & Incident Response Team  
> **Last Updated:** 2026-09-29  

---

## 1. Incident Severity Matrix

| Severity | Definition | Response SLA | Action Trigger |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core DB down, Worker crash loop, Score corruption | $< 15\text{ minutes}$ | Activate Kill Switch, Trigger DR Rebuild |
| **SEV-2 (Major)** | DLQ event spike $> 5\%$, Projection lag $> 10\text{ seconds}$ | $< 1\text{ hour}$ | Inspect Trace, Execute Manual Retry |
| **SEV-3 (Minor)** | Individual rule discrepancy, Minor UI latency | $< 4\text{ hours}$ | Simulate AST in Sandbox, Draft new Rule Version |

---

## 2. Standard Operating Procedures (SOP) by Scenario

### Scenario 1: Competition Engine Worker Dies / Crashes
1. **Detection:** `/health/ready` or `/api/competition/admin/integration/health` reports growing `PENDING` queue.
2. **Action:**
   - Review container logs for fatal exceptions: `docker logs workrank-backend --tail 100`.
   - Restart background worker process.
3. **Verification:**
   - Events in `PENDING` status will automatically be evaluated in batches of 50.
   - Verify `DomainEvents` table: `SELECT COUNT(*) FROM competition_events WHERE status = 'PENDING';` decrements to 0.

### Scenario 2: Event Evaluation Failure (Dead-Letter Queue Spike)
1. **Detection:** Admin Integration Health shows non-zero `FAILED` events.
2. **Action:**
   - Fetch event trace: `GET /api/competition/events/:eventId/trace`.
   - Identify if payload contract mismatch or transient database lock occurred.
   - If payload contract issue, patch upstream module or rule version.
   - Execute manual retry: `POST /api/competition/admin/events/:eventId/retry` with descriptive reason.
3. **Verification:**
   - Event status transitions `FAILED` $\to$ `PENDING` $\to$ `PROCESSED`.
   - Score ledger record created with proper audit attribution.

### Scenario 3: Materialized Projection Desynchronization (Read Model Drift)
1. **Detection:** Leaderboard total points does not equal the sum of `ScoreLedger` for that season.
2. **Action:**
   - Do NOT edit database tables directly.
   - Trigger full read model replay from source of truth:
     ```http
     POST /api/competition/admin/projections/rebuild
     Authorization: Bearer <ADMIN_TOKEN>
     Content-Type: application/json
     
     { "reason": "Incident resolution: Read model sync" }
     ```
3. **Verification:**
   - Projector recalculates all summaries and emits `grand:standings_updated` and `leaderboard:updated`.

### Scenario 4: Erroneous Rule Published to Active Season
1. **Detection:** Unintended point awards observed in production.
2. **Action:**
   - **Step 1:** Pause the affected Season immediately via Admin UI or API:
     `PATCH /api/competition/admin/seasons/:seasonId/status` $\to$ `{ "status": "PAUSED", "reason": "Rule anomaly investigation" }`.
   - **Step 2:** Open Visual Rule Builder, clone the current rule set into a new draft version (e.g., v1.0.1), correct the condition/action AST.
   - **Step 3:** Validate and test the new version in Rule Simulator.
   - **Step 4:** Publish v1.0.1 and link it to the Season.
   - **Step 5:** Resume Season: `PATCH .../status` $\to$ `{ "status": "ACTIVE" }`.
   - **Step 6:** If incorrect points were already awarded, issue append-only reconciliation adjustments via Admin Grand/Season Reconciliation API.
