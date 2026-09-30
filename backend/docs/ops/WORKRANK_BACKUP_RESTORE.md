# WORKRANK V3.3 — BACKUP, RESTORE & DISASTER RECOVERY DRILL

> **Version:** WorkRank V3.3 Enterprise Edition  
> **Recovery Targets:** RPO $< 1\text{ minute}$, RTO $< 5\text{ minutes}$ (Measured Rebuild $< 850\text{ ms}$)  
> **Last Updated:** 2026-09-29  

---

## 1. Database Backup Strategy

WorkRank V3.3 uses an Event-Sourced Append-Only architecture. The primary source-of-truth is the `competition_events` table (Event Store) and `score_ledgers` table.

### 1.1. Automated Snapshot Backup (Daily & Continuous WAL)
- **Continuous Archiving:** PostgreSQL Write-Ahead Logging (WAL) or MySQL Binary Logs stream continuously to cloud storage (e.g. AWS S3 / Google Cloud Storage).
- **Point-in-Time Recovery (PITR):** Enables rolling back to any specific second before a catastrophic event.

### 1.2. Manual Database Dump (CLI)
```bash
# PostgreSQL
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f "workrank_backup_$(date +%Y%m%d_%H%M%S).dump"

# MySQL
mysqldump -h $DB_HOST -u $DB_USER -p --single-transaction --quick $DB_NAME > "workrank_backup_$(date +%Y%m%d_%H%M%S).sql"
```

---

## 2. Disaster Recovery & Read Model Rebuild Procedure

In a disaster recovery scenario where materialized read model tables are corrupted, dropped, or desynchronized:

```
                      ┌────────────────────────────┐
                      │    Immutable Event Store   │
                      │    (competition_events)    │
                      └──────────────┬─────────────┘
                                     │
                             Replay Historical
                               Domain Events
                                     │
                                     ▼
                   [competitionReadModelProjector.rebuild()]
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
[CompetitionUserSummary] [SeasonLeaderboardProjection] [GrandLeaderboardProjection]
```

### 2.1. Executing Read Model Rebuild via Code
```javascript
const { rebuildReadModels } = require('./services/competition/competitionReadModel.projector');

await rebuildReadModels({
  actorId: adminUser.id,
  reason: 'Disaster Recovery Restoration Drill',
  full: true,
});
```

### 2.2. Verification & Integrity Checklist Post-Restore
1. **Event Count Match:** Verify total `DomainEvents` equals the number before backup.
2. **Ledger Balance:** Verify sum of `ScoreLedger.pointsDelta` matches `CompetitionUserSummary.totalPoints` across all users.
3. **Grand Championship Standings:** Verify sum of `GrandPointsLedger.grandPointsAwarded` matches `GrandLeaderboardProjection`.
