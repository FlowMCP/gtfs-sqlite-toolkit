# gtfs-sqlite-toolkit

<!-- Badges (License, Node, Workflow, Coverage) — werden aktiv nach Live-Schaltung -->
<!-- ![License](https://img.shields.io/github/license/FlowMCP/gtfs-sqlite-toolkit) -->
<!-- ![Node](https://img.shields.io/badge/node-22-blue) -->
<!-- ![Workflow](https://img.shields.io/github/actions/workflow/status/FlowMCP/gtfs-sqlite-toolkit/test-on-push.yml) -->
<!-- ![Coverage](https://img.shields.io/codecov/c/github/FlowMCP/gtfs-sqlite-toolkit) -->

Convert GTFS Schedule feeds (CSV in ZIP) to queryable SQLite databases with quality seal, capability detection, and reusable default queries.

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
                addon:        'gtfs-sqlite-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/gtfs-sqlite-toolkit'
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
npm install github:FlowMCP/gtfs-sqlite-toolkit

# Pin to a release
npm install github:FlowMCP/gtfs-sqlite-toolkit#v0.1.0
```

> **Not on the npm registry.** The package is distributed via GitHub only. Use the `github:FlowMCP/gtfs-sqlite-toolkit` shorthand in your `package.json` dependencies.

### Auto-Tools

When FlowMCP-CLI accepts a `source: 'sqlite-gtfs'` resource it auto-injects the following tools (subject to the converted feed's capability matrix):

- `searchStops` — full-text search over `stops` (requires `basicLookup`)
- `searchRoutes` — exact name lookup over `routes` (requires `basicLookup`)
- `getDepartures` — upcoming departures per stop (requires `departures`)
- `getShapeForRoute` — shape points for visualization (requires `shapesVisualization` + `routing`)
- `getFlexBookingRules` — booking rule lookup for flex/demand-responsive services (requires `flexService`)
- `nearPoint` — Haversine radius search over `stops`; `{ lat, lon, radiusMeters, limit? }`, radius in METERS, returns stops sorted ascending by `distanceM` (requires `basicLookup`)
- `inBoundingBox` — lon-first (RFC 7946) bounding-box filter over `stops`; `{ minLon, minLat, maxLon, maxLat, limit? }` (requires `basicLookup`)

Tool names are prefixed with the schema namespace (e.g. `gtfsde.searchStops`). When a capability is missing from the converted DB, the corresponding tool is omitted.

`nearPoint` and `inBoundingBox` are spatial-engine methods: they run the Haversine / bbox computation in JS over the `stops` rows (no FTS5, no PostGIS). Call them with an open `better-sqlite3` handle, e.g. `ScheduleDefaultMethods.nearPoint( { db, lat, lon, radiusMeters } )` → `{ stops, matchCount }`. Output rows include `stop_id`, `stop_name`, `stop_lat`, `stop_lon`, plus `distanceM` (rounded, in metres) for `nearPoint`.

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
import { FlowMcpAdapter } from 'gtfs-sqlite-toolkit'

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
npm install github:FlowMCP/gtfs-sqlite-toolkit
# or pin to a release:
npm install github:FlowMCP/gtfs-sqlite-toolkit#v0.1.0
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
import { GtfsSqliteConverter, ScheduleDefaultMethods, ScheduleMetadataSchema, SqliteBuilder } from 'gtfs-sqlite-toolkit'

const { capabilities, dbPath } = await GtfsSqliteConverter.start( { input: './feed.zip', dbPath: './x.db' } )
const methods = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities } )

const { db } = SqliteBuilder.openDatabase( { dbPath } )
const searchStops = methods.find( ( m ) => m.name === 'searchStops' )
const rows = db.prepare( searchStops.sqlTemplate.replace( ':query', `'Hauptbahnhof'` ).replace( ':limit', '10' ) ).all()
SqliteBuilder.close( { db } )
```

## Echte GTFS-Daten konvertieren

Die in `tests/fixtures/synthetic-gtfs/` mitgelieferte Mini-Fixture (CC0) deckt alle Tests und Integration-Szenarien ab — fuer den produktiven Einsatz braucht ihr aber echte Provider-Feeds. Da GTFS-Feeds individuellen Provider-Lizenzen unterliegen und FlowMCP keine fremden Daten in seinen oeffentlichen Repos verteilt, laeuft der Weg vom Provider-Feed zur aktivierten FlowMCP-Resource in vier Schritten.

1. **Feed beschaffen.** GTFS-Schedule-Feeds werden direkt vom Provider geladen — z.B. von `https://gtfs.de/de/feeds/de_full/`, regionalen Open-Data-Portalen oder Provider-eigenen Download-Seiten. Lizenz und Nutzungsbedingungen variieren je Quelle; sie zu pruefen ist Sache des Users. Dieses Repo gibt keine kuratierte Provider-Liste.

2. **Konvertieren.** Den geladenen Feed in eine SQLite-DB umsetzen und den Seal-Status pruefen:

   ```javascript
   import { GtfsSqliteConverter } from 'gtfs-sqlite-toolkit'

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

   Wenn der Seal `null` ist, sind Validation-Errors oder -Warnings im Feed — `result.report` enthaelt die Details. FlowMCP-CLI nimmt nur DBs mit Seal `sqlite-gtfs` an.

3. **Seal verifizieren.** Vor dem Verschieben kann unabhaengig nachgeprueft werden, dass die DB FlowMCP-konform ist:

   ```javascript
   import { FlowMcpAdapter } from 'gtfs-sqlite-toolkit'

   const { sealed, meta } = FlowMcpAdapter.verifySeal( { dbPath: './gtfs-de.db' } )
   console.log( sealed, meta.qualitySeal, meta.specRevision )
   ```

   `sealed: true` heisst: die DB hat den Seal, die `meta`-Tabelle ist vollstaendig, und FlowMCP-CLI wird sie akzeptieren.

4. **Ablage und Aktivierung.** Die DB in das Resource-Verzeichnis verschieben und das Schema aktivieren:

   ```bash
   mv ./gtfs-de.db ~/.flowmcp/resources/gtfs-de.db
   flowmcp add gtfsde-transit-v2
   ```

   `~/.flowmcp/resources/` ist der Default-Aufloesungs-Ort fuer `${FLOWMCP_RESOURCES}`. Wer einen anderen Pfad nutzen will, setzt `export FLOWMCP_RESOURCES=/anderer/pfad` und verschiebt die DB entsprechend.

### Lizenz-Hinweis

Provider-GTFS-Daten haben individuelle Lizenzen. Das Repo enthaelt **ausschliesslich** die Synthetic-Fixture unter `tests/fixtures/synthetic-gtfs/` (CC0). Provider-Daten gehoeren niemals ins Repo — das Pre-Push-Skript [`scripts/check-no-provider-data.sh`](scripts/check-no-provider-data.sh) bricht Commits ab, die solche Daten enthalten. Wer Schemas oder Tools beitraegt, liefert nur Code und Pfad-Variablen, niemals den Feed selbst.

### Synthetic-Fixture als Ausgangspunkt

Fuer Entwicklung und CI gibt es die Mini-GTFS-Fixture unter `tests/fixtures/synthetic-gtfs/`. Sie deckt alle 12 Capabilities ab und ist CC0-lizenziert — beliebig nutzbar. Die Fixture wird via [`tests/fixtures/build-fixture.mjs`](tests/fixtures/build-fixture.mjs) regeneriert.

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
git clone https://github.com/FlowMCP/gtfs-sqlite-toolkit
cd gtfs-sqlite-toolkit
npm install         # installs dev + runtime deps; uses git source, not npm registry
npm test
npm run test:coverage:src
```

**Note:** This package is **not** on the npm registry. Distribution is via GitHub only (`github:FlowMCP/gtfs-sqlite-toolkit`).

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
