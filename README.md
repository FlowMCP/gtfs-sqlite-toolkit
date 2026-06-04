# geo-gtfs-toolkit

**Version:** 0.2.0

<!-- Badges (License, Node, Workflow, Coverage) — enabled after going public -->
<!-- ![License](https://img.shields.io/github/license/FlowMCP/geo-gtfs-toolkit) -->
<!-- ![Node](https://img.shields.io/badge/node-22-blue) -->
<!-- ![Workflow](https://img.shields.io/github/actions/workflow/status/FlowMCP/geo-gtfs-toolkit/test-on-push.yml) -->
<!-- ![Coverage](https://img.shields.io/codecov/c/github/FlowMCP/geo-gtfs-toolkit) -->

Convert GTFS Schedule feeds (CSV in ZIP) to queryable SQLite databases with quality seal, capability detection, and reusable default queries.

This add-on is part of the FlowMCP geo add-on family (`geo-geojson-toolkit` /
`geo-csv-tsv-toolkit` / `geo-gtfs-toolkit` / `geo-overpass-toolkit`). It shares
the common geo spatial methods — `nearPoint`, `inBoundingBox` (over `stops`) —
and adds GTFS-specific methods (`searchStops`, `searchRoutes`, `getDepartures`,
`getShapeForRoute`, `getFlexBookingRules`).

## Runtime category

**sealed-SQLite** (on-disk database with a quality seal). Unlike the In-Memory
add-ons (`geo-geojson-toolkit` / `geo-csv-tsv-toolkit`), the GTFS feed is
converted once into a sealed `.db` file and queried from disk.

> **Calibrated against the official GTFS Schedule Reference** ([gtfs.org/documentation/schedule/reference/](https://gtfs.org/documentation/schedule/reference/)), source-of-truth Markdown at [github.com/google/transit](https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md). Spec revision tracked: **2026-04-27** (downloaded on 2026-05-21). All 32 schedule files, 214 fields, and 52 foreign-key relations are derived from that exact snapshot — see [`src/converters/schedule/spec/spec-reference-2026-04-27.json`](src/converters/schedule/spec/spec-reference-2026-04-27.json) and the [GTFS Schedule Reference](#gtfs-schedule-reference) section below.

## FlowMCP Integration

### Overview

This toolkit is the first **FlowMCP add-on**: it converts GTFS feeds into a sealed SQLite resource that any FlowMCP schema can declare via `source: 'sqlite-gtfs'` (FlowMCP Spec v4.1.0). The schema points at a converted DB, and the FlowMCP-CLI auto-injects a curated set of GTFS tools by reading the quality seal and capability matrix the converter has written into the `meta` table.

The toolkit is distributed as a GitHub repository — **not** via the npm registry. See [Import](#import) below.

### Schema Example

```javascript
export const schema = {
    namespace: 'gtfsde',
    name: 'gtfsde-transit-v2',
    version: '2.0.0',
    main: {
        resources: [
            {
                source:       'sqlite-gtfs',
                mode:         'file-based',
                path:         '${FLOWMCP_RESOURCES}/gtfs-de.db',
                addon:        'geo-gtfs-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/geo-gtfs-toolkit'
            }
        ],
        tools: [
            // OPTIONAL: schema-specific tools here.
            // Default GTFS tools are injected automatically (see Auto-Tools below).
        ]
    }
}
```

`${FLOWMCP_RESOURCES}` resolves to the env var of the same name, with the default `~/.flowmcp/resources/`. Provider GTFS data is never shipped in this repository — users place their converted DB under that path locally.

### Import

```bash
# Latest from main
npm install github:FlowMCP/geo-gtfs-toolkit

# Pin to a release
npm install github:FlowMCP/geo-gtfs-toolkit#v0.1.0
```

> **Not on the npm registry.** The package is distributed via GitHub only. Use the `github:FlowMCP/geo-gtfs-toolkit` shorthand in your `package.json` dependencies.

### Auto-Tools

When FlowMCP-CLI accepts a `source: 'sqlite-gtfs'` resource it auto-injects the following tools (subject to the converted feed's capability matrix):

- `searchStops` — full-text search over `stops` (requires `basicLookup`)
- `searchRoutes` — exact name lookup over `routes` (requires `basicLookup`)
- `getDepartures` — upcoming departures per stop (requires `departures`)
- `getShapeForRoute` — shape points for visualization (requires `shapesVisualization` + `routing`)
- `getFlexBookingRules` — booking rule lookup for flex/demand-responsive services (requires `flexService`)
- `nearPoint` — Haversine radius search over `stops`; `{ lat, lon, radiusMeters, limit? }`, radius in METERS, returns a normalized RFC 7946 `FeatureCollection` sorted ascending by `_distanceMeters` (requires `basicLookup`)
- `inBoundingBox` — lon-first (RFC 7946) bounding-box filter over `stops`; `{ minLon, minLat, maxLon, maxLat, limit? }`, returns a normalized RFC 7946 `FeatureCollection` (requires `basicLookup`)

Tool names are prefixed with the schema namespace (e.g. `gtfsde.searchStops`). When a capability is missing from the converted DB, the corresponding tool is omitted.

`nearPoint` and `inBoundingBox` are spatial-engine methods: they run the Haversine / bbox computation in JS over the `stops` rows (no FTS5, no PostGIS). Call them with an open `better-sqlite3` handle, e.g. `ScheduleDefaultMethods.nearPoint( { db, lat, lon, radiusMeters } )`. Both return the canonical normalized GeoJSON output (the same "gleicher Standard" shared by the geojson, csv and geo-overpass toolkits):

```js
{
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [ stop_lon, stop_lat ] }, // lon-first (RFC 7946)
            properties: {
                stop_id, stop_name,
                _source: 'gtfs-de',
                _distanceMeters: 123.4 // haversine metres (rounded 0.1) for nearPoint; null for inBoundingBox
            }
        }
    ],
    meta: { count: 1, source: 'gtfs-de' }
}
```

`nearPoint` features are sorted ascending by `_distanceMeters` and sliced to `limit`; `inBoundingBox` features carry `_distanceMeters: null` and are sliced to `limit`. `meta.count` equals `features.length`. The non-spatial schedule methods (`searchStops`, `searchRoutes`, `getDepartures`, `getShapeForRoute`, `getFlexBookingRules`) return plain row arrays / objects as before — they are unchanged.

### Capability Matrix

The auto-tool list is filtered by the 12-boolean capability matrix detected at conversion time. See [Capability Matrix](#capability-matrix) below for the full list and trigger files.

### Seal Verification

Before auto-injection the CLI calls `FlowMcpAdapter.verifySeal( { dbPath } )` to make sure the database is `sqlite-gtfs`-conformant. The result has the shape `{ sealed, meta, reason? }` where `reason` is one of:

| Reason | Meaning |
|--------|---------|
| `NO_SEAL` | `meta.qualitySeal` is missing or not `'sqlite-gtfs'`. Schema rejected with FlowMCP code `RES032`. |
| `NO_META` | DB exists but the `meta` table is absent. Treated as `RES032` (no seal). |
| `DB_UNREADABLE` | File missing, locked, or corrupt. CLI rejects with FlowMCP code `RES033`. |

When `sealed === true`, `meta` carries the 10 mandatory keys (`qualitySeal`, `specUrl`, `specRevision`, `converterVersion`, `sourceUrl`, `sourceHash`, `buildDate`, `rowCounts`, `capabilities`, `validationReport`).

### Adapter API

The `FlowMcpAdapter` class exposes three static methods consumed by FlowMCP-CLI:

```javascript
import { FlowMcpAdapter } from 'geo-gtfs-toolkit'

// 1. Seal check — first gate of `flowmcp add`
const { sealed, meta, reason } = FlowMcpAdapter.verifySeal( { dbPath } )
// → { sealed: boolean, meta: object | null, reason?: 'NO_SEAL' | 'NO_META' | 'DB_UNREADABLE' }

// 2. Capability-filtered method catalog
const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath } )
// → { methods: Array<{ name, params, sqlTemplate, outputSchema, requiresCapabilities }>,
//     capabilities: { basicLookup: boolean, ... } }

// 3. FlowMCP v4 tool definitions with namespace prefix
const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )
// → { tools: Array<{ name, description, inputSchema, outputSchema, requiresCapabilities, sqlTemplate }> }
```

All three methods validate their inputs and throw a descriptive `Error` for missing or malformed parameters. `namespace` must match `/^[a-z][a-z0-9-]*$/`.

## Quickstart

This toolkit is published as a GitHub repo, **not** on the npm registry. Install via the GitHub shorthand:

```bash
npm install github:FlowMCP/geo-gtfs-toolkit
# or pin to a release:
npm install github:FlowMCP/geo-gtfs-toolkit#v0.1.0
```

```javascript
import { GtfsSqliteConverter } from 'geo-gtfs-toolkit'

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
- [FlowMCP Integration](#flowmcp-integration)
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

Filter the catalog of 7 standard methods (`searchStops`, `searchRoutes`, `getDepartures`, `getShapeForRoute`, `getFlexBookingRules`, `nearPoint`, `inBoundingBox`) by what the capabilities matrix supports. Each method has `sqlTemplate`, `params`, and `outputSchema`. The two spatial methods (`nearPoint`, `inBoundingBox`) additionally carry a `spatialEngine: true` marker and are executed via `ScheduleDefaultMethods.nearPoint( { db, ... } )` / `ScheduleDefaultMethods.inBoundingBox( { db, ... } )` (Haversine / bbox computed in JS over the `stops` rows).

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
import { GtfsSqliteConverter, ScheduleDefaultMethods, ScheduleMetadataSchema, SqliteBuilder } from 'geo-gtfs-toolkit'

const { capabilities, dbPath } = await GtfsSqliteConverter.start( { input: './feed.zip', dbPath: './x.db' } )
const methods = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities } )

const { db } = SqliteBuilder.openDatabase( { dbPath } )
const searchStops = methods.find( ( m ) => m.name === 'searchStops' )
const rows = db.prepare( searchStops.sqlTemplate.replace( ':query', `'Hauptbahnhof'` ).replace( ':limit', '10' ) ).all()
SqliteBuilder.close( { db } )
```

## Converting real GTFS data

The mini fixture shipped under `tests/fixtures/synthetic-gtfs/` (CC0) covers all
tests and integration scenarios — but for production use you need real provider
feeds. Because GTFS feeds carry individual provider licenses and FlowMCP never
ships foreign data in its public repos, the path from a provider feed to an
activated FlowMCP resource has four steps.

1. **Obtain the feed.** GTFS Schedule feeds are downloaded directly from the
   provider — e.g. from `https://gtfs.de/de/feeds/de_full/`, regional open-data
   portals, or a provider's own download pages. License and terms of use vary by
   source; checking them is the user's responsibility. This repo ships no curated
   provider list.

2. **Convert.** Turn the downloaded feed into a SQLite DB and check the seal status:

   ```javascript
   import { GtfsSqliteConverter } from 'geo-gtfs-toolkit'

   const result = await GtfsSqliteConverter.start( {
       input:     './gtfs-de.zip',
       inputType: 'zip',
       dbPath:    './gtfs-de.db'
   } )

   if( result.seal !== 'sqlite-gtfs' ) {
       console.error( 'Seal not granted:', result.report.summary )
       process.exit( 1 )
   }
   ```

   When the seal is `null`, the feed contains validation errors or warnings —
   `result.report` holds the details. FlowMCP-CLI only accepts DBs with the
   `sqlite-gtfs` seal.

3. **Verify the seal.** Before moving the file you can independently confirm the
   DB is FlowMCP-conformant:

   ```javascript
   import { FlowMcpAdapter } from 'geo-gtfs-toolkit'

   const { sealed, meta } = FlowMcpAdapter.verifySeal( { dbPath: './gtfs-de.db' } )
   console.log( sealed, meta.qualitySeal, meta.specRevision )
   ```

   `sealed: true` means: the DB has the seal, the `meta` table is complete, and
   FlowMCP-CLI will accept it.

4. **Placement and activation.** Move the DB into the resource directory and let a
   FlowMCP schema declare it:

   ```bash
   mv ./gtfs-de.db ~/.flowmcp/resources/gtfs-de.db
   ```

   `~/.flowmcp/resources/` is the default resolution path for
   `${FLOWMCP_RESOURCES}`. To use a different path, set
   `export FLOWMCP_RESOURCES=/other/path` and move the DB accordingly. A schema
   that references the DB via `source: 'sqlite-gtfs'` then exposes the GTFS tools
   through the standard FlowMCP `list` / `call` workflow.

### License note

Provider GTFS data carries individual licenses. This repo contains **only** the
synthetic fixture under `tests/fixtures/synthetic-gtfs/` (CC0). Provider data must
never enter the repo — the pre-push script
[`scripts/check-no-provider-data.sh`](scripts/check-no-provider-data.sh) aborts
commits that contain such data. Contributors ship only code and path variables,
never the feed itself.

### Synthetic fixture as a starting point

For development and CI there is the mini GTFS fixture under
`tests/fixtures/synthetic-gtfs/`. It covers all 12 capabilities and is CC0-licensed
— free to use. The fixture is regenerated via
[`tests/fixtures/build-fixture.mjs`](tests/fixtures/build-fixture.mjs).

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
- **Tracked revision:** `2026-04-27`
- **Downloaded:** 2026-05-21 — snapshot in `projects/flowmcp/context/gtfs-schedule-spec-2026-04-27/` (workbench-local, not committed to this repo)
- **Derived data:** [`src/converters/schedule/spec/spec-reference-2026-04-27.json`](src/converters/schedule/spec/spec-reference-2026-04-27.json) — 32 files, 214 fields, 52 FK relations, generated by [`tools/build-spec-reference.mjs`](tools/build-spec-reference.mjs)
- **License (spec):** Apache 2.0
- **Realtime (out of scope):** https://gtfs.org/documentation/realtime/reference/

When a new GTFS revision is published, drop a fresh `reference.md` next to the tool, run `node tools/build-spec-reference.mjs /path/to/reference.md` to produce a new `spec-reference-YYYY-MM-DD.json`, and update the import in [`src/converters/schedule/spec/spec-reference.mjs`](src/converters/schedule/spec/spec-reference.mjs) plus the `SPEC_REVISION` constant.

The spec reference is versioned by date in the filename. A constant wrapper `spec/spec-reference.mjs` re-exports the active version, so consumer code stays stable when a new revision is added.

## Error Codes

All 21 codes are documented in [`docs/error-codes.md`](docs/error-codes.md) with severity, default file context, meaning, and example.

## Contributing

Local development:

```bash
git clone https://github.com/FlowMCP/geo-gtfs-toolkit
cd geo-gtfs-toolkit
npm install         # installs dev + runtime deps; uses git source, not npm registry
npm test
npm run test:coverage:src
```

**Note:** This package is **not** on the npm registry. Distribution is via GitHub only (`github:FlowMCP/geo-gtfs-toolkit`).

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
