# Synthetic Mini-GTFS Fixture (CC0)

A fully fictional GTFS Schedule dataset used for reproducible tests of the `geo-gtfs-toolkit` and its FlowMCP integration. No real transit-provider data is included.

## Purpose

Allow integration tests, CI runs and FlowMCP CLI exercises to run without distributing or relying on third-party provider data. Real GTFS feeds carry provider-specific license terms and must not enter this repository.

## License

**CC0 1.0 Universal — Public Domain Dedication.**

The seven source CSVs in `source/` are an original synthetic work. They contain no real agency names, stop names, route numbers, or coordinates from any real transit system. The dedication is documented in `LICENSE`.

## Contents

```
synthetic-gtfs/
├── LICENSE              CC0 1.0 Universal legal text
├── README.md            this file
├── build-fixture.mjs    builds synthetic-gtfs.db from source/
├── source/              seven GTFS Schedule CSVs (committed, CC0)
│   ├── agency.txt       1 fictional agency
│   ├── stops.txt        5 fictional stops
│   ├── routes.txt       2 fictional routes (Bus + Tram)
│   ├── trips.txt        6 trips (3 per route)
│   ├── stop_times.txt   ~30 entries with realistic timing
│   ├── calendar.txt     3 service IDs (Mo-Fr, Sa, So)
│   └── shapes.txt       2 shape paths (fictional coordinates)
└── synthetic-gtfs.db    build artifact, gitignored
```

## Building

```bash
node tests/fixtures/synthetic-gtfs/build-fixture.mjs
```

The script reads `source/`, converts it via `GtfsSqliteConverter`, and writes `synthetic-gtfs.db` next to itself. The build is deterministic — re-running yields byte-identical output.

## Capabilities

The resulting database activates four of twelve `ScheduleCapabilityDetector` booleans:

| Capability | State | Reason |
|------------|-------|--------|
| `basicLookup` | true | agency + stops + routes present |
| `routing` | true | trips + stop_times + calendar present |
| `departures` | true | stop_times with arrival/departure pairs |
| `shapesVisualization` | true | shapes.txt with two paths |
| `flexService` | false | no `locations.geojson` / `booking_rules.txt` |
| `fares` | false | no fare files |
| `transfers` | false | no `transfers.txt` |
| `frequencies` | false | no `frequencies.txt` |
| `pathways` | false | no `pathways.txt` |
| `levels` | false | no `levels.txt` |
| `feedInfo` | false | no `feed_info.txt` |
| `translations` | false | no `translations.txt` |

This is intentional — the four enabled capabilities exercise the most common FlowMCP auto-tool surface (`searchStops`, `searchRoutes`, `getDepartures`, `getShapeForRoute`) without forcing every test to construct flex bookings or fare structures.

## Repository policy

- `source/*.txt` is **tracked** (original CC0 work).
- `synthetic-gtfs.db` is **gitignored** (rebuilt on demand).
- `synthetic-gtfs.db-shm` and `synthetic-gtfs.db-wal` (SQLite WAL artifacts) are also gitignored via the global `*.db` pattern in the repository `.gitignore`.

For real provider feeds, follow the workflow in the top-level README under "Converting Real GTFS Data" — user-provided data lives outside the repository at `${FLOWMCP_RESOURCES}/`.
