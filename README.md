# gtfs-sqlite-toolkit

<!-- Badges (License, Node, Workflow, Coverage) — werden aktiv nach Live-Schaltung -->
<!-- ![License](https://img.shields.io/github/license/FlowMCP/gtfs-sqlite-toolkit) -->
<!-- ![Node](https://img.shields.io/badge/node-22-blue) -->
<!-- ![Workflow](https://img.shields.io/github/actions/workflow/status/FlowMCP/gtfs-sqlite-toolkit/test-on-push.yml) -->
<!-- ![Coverage](https://img.shields.io/codecov/c/github/FlowMCP/gtfs-sqlite-toolkit) -->

Convert GTFS Schedule feeds (CSV in ZIP) to queryable SQLite databases with quality seal, capability detection, and reusable default queries.

## Quickstart

```bash
npm install gtfs-sqlite-toolkit
```

```javascript
import { GtfsSqliteConverter } from 'gtfs-sqlite-toolkit'

const result = await GtfsSqliteConverter.start( {
    input:     './my-feed.zip',
    inputType: 'zip',
    dbPath:    './my-feed.db'
} )

console.log( result.seal )         // 'sqlite-gtfs' or null
console.log( result.capabilities ) // { basicLookup: true, routing: true, ... }
console.log( result.report.summary ) // { errorCount, warningCount, infoCount }
```

## Features

- **5 input variants:** `zip` path, `buffer` (ZIP bytes), `folder` path, `targz` path, `auto`-detect
- **Pre-validation:** required files, required fields, datatypes, foreign keys checked **before** the database is built
- **Force mode:** convert anyway, skip error files, never seal
- **Quality seal `sqlite-gtfs`:** awarded only when validation produces zero errors and zero warnings (single-bit signal — present or `null`)
- **Capability matrix:** 12 booleans describe what queries are usable against the resulting DB
- **Default methods:** ready-made SQL templates with output schemas, filtered by capabilities
- **Single-version spec reference:** `spec-reference-2026-04-27.json` tracks the GTFS revision; constant wrapper `spec/spec-reference.mjs` re-exports
- **21 error codes** (`GTFS-NNN`): 8 ERROR, 7 WARNING, 6 INFO — see [`docs/error-codes.md`](docs/error-codes.md)
- **No `.env`, no `.git/` during development:** zero external dependencies at runtime, repo is fully self-contained

## Table of Contents

- [Quickstart](#quickstart)
- [Features](#features)
- [Methods](#methods)
- [Examples](#examples)
- [Capability Matrix](#capability-matrix)
- [GTFS Schedule Reference](#gtfs-schedule-reference)
- [Error Codes](#error-codes)
- [Contributing](#contributing)
- [License](#license)

## Methods

### `GtfsSqliteConverter.start( { input, inputType, force, dbPath, gtfsSpec, sourceUrl } )` → `Promise<{ status, dbPath, report, capabilities, seal, aborted }>`

Convert a GTFS Schedule feed to SQLite.

| Param | Type | Default | Required |
|-------|------|---------|----------|
| `input` | `Buffer` \| `string` | — | yes |
| `inputType` | `'zip'` \| `'buffer'` \| `'folder'` \| `'targz'` \| `'auto'` | `'auto'` | no |
| `force` | `boolean` | `false` | no |
| `dbPath` | `string` (absolute or relative) | — | yes |
| `gtfsSpec` | `'schedule'` | `'schedule'` | no |
| `sourceUrl` | `string` \| `null` | `null` | no |

Returns:

| Key | Type | Notes |
|-----|------|-------|
| `status` | `boolean` | `true` if DB was written |
| `dbPath` | `string` \| `null` | Path to the SQLite file, `null` if aborted |
| `report` | `{ status, errors, warnings, info, summary }` | Validation report from `Validation.report()` |
| `capabilities` | `Object<string, boolean>` | 12 booleans — see [Capability Matrix](#capability-matrix) |
| `seal` | `'sqlite-gtfs'` \| `null` | Quality seal, `null` if any warning, error, or `force=true` was used |
| `aborted` | `boolean` | `true` if errors were detected and `force=false` |

### `ScheduleMetadataSchema.parseMeta( { dbPath } )` → `metaObject`

Read the `meta` table back from a converted DB. All 10 mandatory keys (`qualitySeal`, `specUrl`, `specRevision`, `converterVersion`, `sourceUrl`, `sourceHash`, `buildDate`, `rowCounts`, `capabilities`, `validationReport`).

### `ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities } )` → `Array<methodDef>`

Filter the catalog of 5 standard methods (`searchStops`, `searchRoutes`, `getDepartures`, `getShapeForRoute`, `getFlexBookingRules`) by what the capabilities matrix supports. Each method has `sqlTemplate`, `params`, and `outputSchema`.

## Examples

### Basic conversion from ZIP

```javascript
const result = await GtfsSqliteConverter.start( {
    input:     './gtfs-feed.zip',
    inputType: 'zip',
    dbPath:    './gtfs.db'
} )
if( result.seal === 'sqlite-gtfs' ) {
    // strict-conformant — all default methods usable
}
```

### Auto-detect from Buffer

```javascript
const zipBuffer = await fetch( 'https://example.com/feed.zip' ).then( ( r ) => r.arrayBuffer() )
const result = await GtfsSqliteConverter.start( {
    input:  Buffer.from( zipBuffer ),
    dbPath: './gtfs.db'
    // inputType defaults to 'auto' — magic-byte detection
} )
```

### Force mode (convert despite errors)

```javascript
const result = await GtfsSqliteConverter.start( {
    input:     './incomplete-feed.zip',
    force:     true,
    dbPath:    './gtfs.db'
} )
// result.seal === null, result.report.errors.length > 0, but result.dbPath exists
```

### Using default methods

```javascript
import { GtfsSqliteConverter, ScheduleDefaultMethods, ScheduleMetadataSchema, SqliteBuilder } from 'gtfs-sqlite-toolkit'

const { capabilities, dbPath } = await GtfsSqliteConverter.start( { input: './feed.zip', dbPath: './x.db' } )
const methods = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities } )

const { db } = SqliteBuilder.openDatabase( { dbPath } )
const searchStops = methods.find( ( m ) => m.name === 'searchStops' )
const rows = db.prepare( searchStops.sqlTemplate.replace( ':query', `'Hauptbahnhof'` ).replace( ':limit', '10' ) ).all()
SqliteBuilder.close( { db } )
```

## Capability Matrix

The converter detects 12 boolean capabilities from a feed's file inventory:

| Capability | Trigger |
|------------|---------|
| `basicLookup` | `agency.txt` + `stops.txt` + `routes.txt` |
| `routing` | `trips.txt` + `stop_times.txt` |
| `departures` | `stop_times.txt` + (`calendar.txt` or `calendar_dates.txt`) |
| `shapesVisualization` | `shapes.txt` |
| `continuousBoarding` | `continuous_pickup`/`continuous_drop_off` in `routes.txt` or `stop_times.txt` |
| `stationNavigation` | `pathways.txt` + `levels.txt` |
| `fareCalculationV2` | `fare_leg_rules.txt` or `fare_products.txt` |
| `fareTransfers` | `fare_transfer_rules.txt` |
| `flexService` | `booking_rules.txt` or `locations.geojson` or `location_groups.txt` |
| `frequencyBased` | `frequencies.txt` |
| `multilingual` | `translations.txt` |
| `licensedAttribution` | non-empty `attributions.txt` |

## GTFS Schedule Reference

This toolkit converts GTFS **Schedule** feeds (CSV in ZIP). It does **not** support GTFS **Realtime** (Protobuf).

- **Human-readable spec:** https://gtfs.org/documentation/schedule/reference/
- **Source of truth (Markdown):** https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md
- **Tracked revision:** `2026-04-27` — see [`src/converters/schedule/spec/spec-reference-2026-04-27.json`](src/converters/schedule/spec/spec-reference-2026-04-27.json) (32 files, 214 fields, 52 FK relations)
- **License (spec):** Apache 2.0
- **Realtime (out of scope):** https://gtfs.org/documentation/realtime/reference/

The spec reference is versioned by date in the filename. A constant wrapper `spec/spec-reference.mjs` re-exports the active version, so consumer code stays stable when a new revision is added.

## Error Codes

All 21 codes are documented in [`docs/error-codes.md`](docs/error-codes.md) with severity, default file context, meaning, and example.

## Contributing

Local development:

```bash
git clone https://github.com/FlowMCP/gtfs-sqlite-toolkit
cd gtfs-sqlite-toolkit
npm install
npm test
npm run test:coverage:src
```

Manual POC scripts (need real data, see `tests/manual/run-*.mjs`):

```bash
node tests/manual/run-gtfs-de.mjs    # download first: see script header
```

Spec-reference regeneration when a new GTFS revision is published:

```bash
node tools/build-spec-reference.mjs /path/to/new/reference.md
```

## License

MIT — see [LICENSE](./LICENSE).
