# Known Issues

Tracking notes for issues that are out of scope for the change that discovered
them. Each entry should be filed as a separate GitHub issue.

## FTS5 index is never built in production — `searchStops` cannot work on real DBs

- **Discovered by:** Memo 100 PRD-014 (GTFS spatial / Haversine) — nebenbefund only, NOT fixed there.
- **Location:** `src/shared/SqliteBuilder.mjs:48` — `SqliteBuilder.createFts5Index()`.
- **Symptom:** `createFts5Index()` is defined and unit-tested
  (`tests/public-methods/shared.SqliteBuilder.test.mjs`) but is **never called
  from production code** (verified via repo-wide grep — the only call sites are
  in that test). Meanwhile `ScheduleDefaultMethods.searchStops` declares
  `sqlTemplate: '... FROM stops_fts WHERE stops_fts MATCH :query ...'`, which
  requires a `stops_fts` virtual table that the converter never creates.
  Therefore `searchStops` will fail (`no such table: stops_fts`) against any
  database produced by `GtfsSqliteConverter`.
- **Scope note:** The spatial methods added in PRD-014 (`nearPoint`,
  `inBoundingBox`) deliberately do **not** depend on FTS5 — they run a plain
  `SELECT ... FROM stops` plus an in-process Haversine/bbox filter, so they are
  unaffected by this bug.
- **Suggested fix (separate issue):** Either wire `createFts5Index()` into the
  converter build step (create `stops_fts` after inserting `stops`), or change
  `searchStops.sqlTemplate` to query `stops` directly with a `LIKE`/`=`
  predicate. Decision belongs in its own issue/PRD.
- **Do NOT change `SqliteBuilder` as part of PRD-014.**
