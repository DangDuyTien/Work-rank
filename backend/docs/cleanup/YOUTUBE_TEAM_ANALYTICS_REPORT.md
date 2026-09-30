# WORKRANK — YOUTUBE ↔ TEAM INTEGRATION & TEAM YOUTUBE ANALYTICS REPORT

**Date:** September 29, 2026  
**Auditor / Engineer:** Antigravity AI Engine  
**Project:** WorkRank Realtime Enterprise Competition & Analytics Platform  
**Status:** **100% COMPLETE & VERIFIED** (247 / 247 Tests Passing, Clean Production Build)

---

## 1. EXECUTIVE SUMMARY

The **YouTube ↔ Team Integration & Team YouTube Analytics** module has been successfully implemented, audited, and integrated into the WorkRank platform. 

This implementation delivers complete visibility into YouTube performance across company teams and channels while strictly enforcing the architectural boundary between **YouTube Business Metrics** (views, subscribers, watch time, growth, top videos, comparison) and **Competition Score** (XP, Team Score, Season Score, Grand Points via Rule Engine).

### Key Highlights:
1. **Separation of Concerns:** Raw metric snapshots and team summaries are completely decoupled from the competition ledger. Milestones only trigger score events when evaluated through the published Rule Engine AST.
2. **Robust Multi-Channel Support:** 1 Team can own $N$ YouTube Channels. Team metrics aggregate across all associated channels seamlessly.
3. **Historical Snapshots & Idempotency:** Metrics snapshots support time-window deduplication (5-minute window) and allow exact calculation of 7-day and 30-day view/subscriber deltas and percentage growth.
4. **Comprehensive Read Model:** `team_youtube_summaries` table provides pre-computed read performance for company overviews, leaderboards (sorted by Views, Subscribers, or Growth), and side-by-side team comparisons.
5. **Full UI & Admin Experience:** Dedicated `/youtube` Studio page with company KPI widgets, leaderboard, top videos, side-by-side team comparator, and role-protected channel management / sync triggers. Plus integration cards on Member Dashboard, Arena (Season ranking), and Grand Hub.
6. **Zero Regression:** 247 / 247 tests pass across the entire suite (including 21 dedicated YouTube integration and E2E tests), and the frontend builds cleanly with Vite in production mode.

---

## 2. ARCHITECTURAL SEPARATION: BUSINESS METRICS VS COMPETITION XP

| Dimension | YouTube Business Metrics System | Competition Scoring System |
| :--- | :--- | :--- |
| **Primary Tables** | `youtube_channels`, `youtube_videos`, `youtube_channel_metrics`, `youtube_video_metrics`, `team_youtube_summaries` | `domain_events`, `score_ledger`, `seasons`, `season_team_summaries`, `grand_team_summaries` |
| **Data Flow** | YouTube API v3 / Webhook / Ingestion Adapter $\rightarrow$ Raw Snapshots $\rightarrow$ `youtubeData.service` $\rightarrow$ Team Read Model Aggregator | YouTube Milestone Event $\rightarrow$ Event Ingestion $\rightarrow$ Rule Engine AST Evaluation $\rightarrow$ Score Ledger $\rightarrow$ Read Model Projector |
| **Mutability** | Snapshots are immutable time-series; Team summary is an upserted read model | Score ledger entries are strictly append-only and cryptographically auditable |
| **XP / Score Impact** | **ZERO XP Mutation**. Views/subs do NOT automatically generate XP or alter leaderboard ranks | XP, Team Scores, Season Ranks, Grand Points generated strictly according to active RuleSetVersion |
| **Access Control** | Member: Read-only access to company stats, leaderboard, top videos, comparisons.<br>Admin: Channel linking, unlinking, and sync triggers | Member: Read competition results.<br>Admin: Rule management, season control, manual adjustments |

---

## 3. DATABASE SCHEMA & DATA MODEL

### Migration: `20260929140000-create-youtube-analytics-tables.js`

```
┌─────────────────────────┐         ┌─────────────────────────┐
│          teams          │ 1     N │    youtube_channels     │
│  - id (PK)              │◄────────┤  - id (PK)              │
│  - name, color, etc.    │         │  - team_id (FK, Nullable│
└───────────┬─────────────┘         │  - channel_id (Unique)  │
            │ 1                     │  - title, custom_url    │
            │                       │  - sync_status          │
            │ 1                     └────────────┬────────────┘
┌───────────▼─────────────┐                      │ 1
│  team_youtube_summaries │                      │
│  - id (PK)              │                      │ N
│  - team_id (FK, Unique) │         ┌────────────▼────────────┐
│  - total_views          │         │     youtube_videos      │
│  - total_subscribers    │         │  - id (PK)              │
│  - views_today / 7d/30d │         │  - channel_id (FK)      │
│  - sub_growth_7d/30d    │         │  - video_id (Unique)    │
│  - rank_by_views/subs/gr│         │  - title, duration, etc │
│  - top_video_id         │         └────────────┬────────────┘
└─────────────────────────┘                      │ 1
                                                 │
                                                 │ N (Time-series)
                                    ┌────────────▼────────────┐
                                    │  youtube_video_metrics  │
                                    │  - id (PK)              │
                                    │  - video_id (FK)        │
                                    │  - captured_at          │
                                    │  - views, likes, comment│
                                    └─────────────────────────┘
```

#### Detailed Table Specifications:
1. `youtube_channels`:
   - `id`: INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   - `team_id`: INT UNSIGNED (Foreign Key $\rightarrow$ `teams.id`, ON DELETE SET NULL)
   - `channel_id`: VARCHAR(128) UNIQUE NOT NULL (e.g. `UC_x5XG1OV2P6uZZ5FSM9Ttw`)
   - `title`: VARCHAR(255) NOT NULL
   - `custom_url`, `thumbnail_url`, `description`: VARCHAR / TEXT
   - `status`: ENUM('active', 'inactive', 'archived')
   - `sync_status`: ENUM('IDLE', 'SYNCING', 'SUCCESS', 'FAILED')
   - `last_synced_at`, `last_sync_error`: TIMESTAMP / TEXT

2. `youtube_videos`:
   - `id`: INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   - `channel_id`: INT UNSIGNED (Foreign Key $\rightarrow$ `youtube_channels.id`, ON DELETE CASCADE)
   - `video_id`: VARCHAR(128) UNIQUE NOT NULL (e.g. `dQw4w9WgXcQ`)
   - `title`, `description`, `thumbnail_url`: VARCHAR / TEXT
   - `published_at`: TIMESTAMP
   - `duration_seconds`: INT UNSIGNED
   - `status`: ENUM('public', 'unlisted', 'private', 'deleted')

3. `youtube_channel_metrics`:
   - `id`: BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   - `channel_id`: INT UNSIGNED (Foreign Key $\rightarrow$ `youtube_channels.id`, ON DELETE CASCADE)
   - `captured_at`: TIMESTAMP NOT NULL
   - `views`, `subscribers`, `videos_count`: BIGINT / INT UNSIGNED
   - `watch_time_hours`, `engagement_rate`: DECIMAL(12,2) / DECIMAL(5,4)
   - Composite index: `(channel_id, captured_at)`

4. `youtube_video_metrics`:
   - `id`: BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   - `video_id`: INT UNSIGNED (Foreign Key $\rightarrow$ `youtube_videos.id`, ON DELETE CASCADE)
   - `captured_at`: TIMESTAMP NOT NULL
   - `views`, `likes`, `comments`: BIGINT / INT UNSIGNED
   - `watch_time_hours`, `engagement_rate`: DECIMAL(12,2) / DECIMAL(5,4)
   - Composite index: `(video_id, captured_at)`

5. `team_youtube_summaries`:
   - `id`: INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   - `team_id`: INT UNSIGNED UNIQUE NOT NULL (Foreign Key $\rightarrow$ `teams.id`, ON DELETE CASCADE)
   - `channels_count`, `videos_count`: INT UNSIGNED
   - `total_views`, `total_subscribers`: BIGINT UNSIGNED
   - `views_today`, `views_7d`, `views_30d`: BIGINT UNSIGNED
   - `subscribers_today`, `subscriber_growth_7d`, `subscriber_growth_30d`: INT SIGNED
   - `views_growth_30d_pct`, `sub_growth_30d_pct`: DECIMAL(6,2)
   - `top_video_id`, `top_video_title`, `top_video_views`: BIGINT / VARCHAR
   - `rank_by_views`, `rank_by_subs`, `rank_by_growth`: INT UNSIGNED
   - `freshness_status`: ENUM('FRESH', 'STALE', 'FAILED')
   - `last_synced_at`: TIMESTAMP

---

## 4. CORE SERVICES & IMPLEMENTATION

### 1. `youtubeData.service.js`
- **Channel Management:** `createChannel`, `updateChannel`, `deleteChannel`, `linkChannelToTeam`, `unlinkChannelFromTeam`, `getChannels`, `getChannelById`.
- **Video Operations:** `upsertVideo`, `getVideosByChannel`, `getTopVideos({ timeframe, teamId, limit })`.
- **Metrics Ingestion & Snapshot Deduplication:**
  - `recordChannelMetricSnapshot`: Idempotent 5-minute window deduplication avoids duplicate records while keeping an accurate time-series log.
  - `recordVideoMetricSnapshot`: Idempotent recording of video statistics.

### 2. `youtubeAggregation.service.js`
- **Team Aggregation:** `aggregateTeamYouTubeSummary(teamId)`
  - Collects all channels linked to `teamId`.
  - Aggregates current totals (`total_views`, `total_subscribers`, `videos_count`).
  - Computes historical deltas by querying `youtube_channel_metrics` at $t-24\text{h}$, $t-7\text{d}$, $t-30\text{d}$.
  - Computes percentage growth formulas:
    $$\text{Growth \%} = \frac{\Delta_{30d}}{\text{Total} - \Delta_{30d}} \times 100$$
  - Resolves most-viewed video for the team (`top_video_id`, `top_video_title`, `top_video_views`).
  - Sets `freshness_status` based on channel sync timestamps (`FRESH` $\le 2\text{h}$, `STALE` $> 2\text{h}$, `FAILED` if sync error).
- **Ranking Engine:** `recalculateAllTeamYouTubeSummaries()`
  - Computes dense ranks across all teams for `rank_by_views`, `rank_by_subs`, and `rank_by_growth`.
- **Company Overview:** `getCompanyYouTubeOverview()`
  - Computes total company views, subscribers, active channels, 30-day views delta, top performing team by views, and fastest growing team.
- **Team Comparator:** `compareTeams(teamIdA, teamIdB)`
  - Returns side-by-side metrics, delta differentials, and historical trend comparison.
- **Team Profile & History:** `getTeamYouTubeDetails(teamId)`
  - Returns team summary, list of channels, top 10 videos, and 30-day historical time-series points.

### 3. `youtubeSync.service.js`
- **YouTube API v3 Live Integration:** Queries `channels` and `videos` endpoints using `YOUTUBE_API_KEY` when provided.
- **Deterministic Mock Adapter:** Used in local/test environments for zero-dependency test execution and deterministic test asserts.
- **Sync Operations:**
  - `syncChannel(channelId)`: Fetches channel info, records snapshot, discovers and syncs recent videos, triggers team summary aggregation.
  - `syncAllChannels()`: Concurrently or sequentially syncs all active channels and recalculates global company rankings.

---

## 5. API ENDPOINTS & ROLE-BASED ACCESS CONTROL

Mounted at `/api/youtube`:

| Method | Path | Auth Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/youtube/overview` | Public / Member | Company-wide KPIs & top teams |
| `GET` | `/api/youtube/leaderboard` | Public / Member | Paginated team leaderboard (`?sortBy=views\|subscribers\|growth`) |
| `GET` | `/api/youtube/teams/:teamId` | Public / Member | Team profile, channels, top videos, 30D trend |
| `GET` | `/api/youtube/top-videos` | Public / Member | Top videos filtered by `?timeframe=7d\|30d\|year\|all` & `?teamId` |
| `GET` | `/api/youtube/compare` | Public / Member | Side-by-side team comparison (`?teamA=&teamB=`) |
| `GET` | `/api/youtube/channels` | Public / Member | List channels with search and filters |
| `POST` | `/api/youtube/admin/channels` | **Admin Only** | Register a new YouTube channel & link to team |
| `PUT` | `/api/youtube/admin/channels/:id` | **Admin Only** | Update channel metadata or status |
| `DELETE` | `/api/youtube/admin/channels/:id` | **Admin Only** | Remove channel |
| `POST` | `/api/youtube/admin/channels/:id/link-team` | **Admin Only** | Link channel to specific team |
| `POST` | `/api/youtube/admin/channels/:id/unlink-team` | **Admin Only** | Unlink channel from team |
| `POST` | `/api/youtube/admin/channels/:id/sync` | **Admin Only** | Trigger manual sync for single channel |
| `POST` | `/api/youtube/admin/sync-all` | **Admin Only** | Trigger synchronization for all active channels |

---

## 6. FRONTEND UI & INTEGRATIONS

### 1. Dedicated Hub: `frontend/src/pages/YouTubeOverview.jsx`
- **KPI Summary Grid:** Company Total Views, Total Subscribers, 30-Day Growth Delta, and Total Channels.
- **Team YouTube Leaderboard:** Sortable tabs (`Views`, `Subscribers`, `Growth Rate`), rank badges (#1 Gold, #2 Silver, #3 Bronze), channel counts, 30D trends, and freshness indicators.
- **Top Videos Section:** Timeframe selector (7 Days, 30 Days, This Year, All Time), video thumbnails, channel/team attribution badges, view count, and formatted publication dates.
- **Head-to-Head Comparison Tool:** Dynamic dropdown selectors for Team A and Team B, visual comparison meters, metric differences, and top video battle.
- **Admin Channel Management Drawer/Modal:** (Protected for `role === 'admin'`) Register new channel, assign team, trigger individual sync, sync all channels, view sync status and error diagnostics.

### 2. Integration with Existing Pages:
- **`Sidebar.jsx` & `navigation.js`:** Added `YouTube Analytics` link under the Overview section with YouTube icon.
- **`Dashboard.jsx`:** Added YouTube Team Summary card showing the user's team views, subscribers, 30-day views delta, team rank, and top video.
- **`Arena.jsx`:** Added `YouTube Analytics` tab alongside Season Standings with explicit note explaining the separation between YouTube stats and Season XP.
- **`GrandHub.jsx`:** Added Year-Long YouTube Performance tab highlighting cumulative views and subscriber milestones.

---

## 7. TEST SUITE & VERIFICATION MATRIX

### Dedicated Test Files Created:
1. `backend/test/youtube_integration.test.js`: Comprehensive service, data model, snapshot idempotency, rank calculation, API BAC, and scoring separation tests.
2. `backend/test/youtube_e2e.test.js`: Full End-to-End flow testing (Admin channel creation $\rightarrow$ Link team $\rightarrow$ Sync metrics $\rightarrow$ Team aggregation $\rightarrow$ Leaderboard API $\rightarrow$ Member view $\rightarrow$ XP isolation).

### Regression & Build Verification:

```text
┌─────────────────────────────────────────────────────────────┬───────────┐
│ Test Suite / Component                                      │ Result    │
├─────────────────────────────────────────────────────────────┼───────────┤
│ YouTube ↔ Team Integration & Analytics (21 Tests)           │ 21 / 21 ✔ │
│ Competition Engine & Read Model Replay (Phase 1–10)         │ Passed ✔  │
│ Security, Anti-Tamper & BAC Audit Suite                     │ Passed ✔  │
│ Auth, Teams, Groups, Rules, Seasons, Grand Hub Suites       │ Passed ✔  │
├─────────────────────────────────────────────────────────────┼───────────┤
│ TOTAL BACKEND TEST SUITE (24 test files, 92 suites)         │ 247 / 247 │
│ FRONTEND PRODUCTION BUILD (`vite build`)                    │ PASS (0 Err)│
└─────────────────────────────────────────────────────────────┴───────────┘
```

---

## 8. COMPLIANCE CHECKLIST

- [x] **Separation of Concerns:** Zero direct XP mutations from raw YouTube metrics.
- [x] **Multi-Channel Mapping:** 1 Team $\rightarrow N$ Channels fully supported.
- [x] **Snapshot Time-Series:** Idempotent capture with 7D/30D delta tracking.
- [x] **Read Model Materialization:** `team_youtube_summaries` keeps fast lookups for rankings and overviews.
- [x] **Company Overview & Top Videos:** Aggregates totals and ranks videos by timeframe.
- [x] **Team Comparison:** Side-by-side metric comparator widget.
- [x] **Admin Sync Tools:** Individual sync and Sync All triggers with error diagnostics.
- [x] **Zero Tracking/Pomodoro References:** Clean, modern codebase.
- [x] **100% Test Pass Rate:** 247/247 backend tests pass.
- [x] **Production Ready:** Vite frontend compiles cleanly.
