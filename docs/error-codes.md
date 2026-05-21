# GTFS-NNN Error Codes

Reference for all 21 codes emitted by `gtfs-sqlite-toolkit`. Codes are grouped by severity, signalled by the numeric range.

| Range | Severity |
|-------|----------|
| `GTFS-001` – `GTFS-099` | ERROR (blocks conversion in default mode) |
| `GTFS-100` – `GTFS-199` | WARNING (allows conversion, but no seal) |
| `GTFS-200` – `GTFS-299` | INFO (informational, seal still possible) |

## ERROR codes

| Code | Default file context | Meaning | Example |
|------|----------------------|---------|---------|
| `GTFS-001` | the missing file | Required file missing | `agency.txt` absent in a feed where it is required |
| `GTFS-002` | the affected file  | Required field missing in file | `routes.txt` exists but column `route_type` is missing |
| `GTFS-003` | the file with the broken reference | Foreign key broken — value not found in referenced table | `trips.route_id = "R-42"` but no such row in `routes.txt` |
| `GTFS-004` | the affected file | Datatype mismatch | Field declared as `Float` contains `"abc"` |
| `GTFS-005` | the affected file | CSV file has no header row | First row of `stops.txt` is empty |
| `GTFS-006` | the affected file | File is empty or unparseable | Zero-byte `agency.txt` |
| `GTFS-007` | n/a | Unsupported spec or version | Caller passes `gtfsSpec: 'realtime'` |
| `GTFS-008` | n/a | No GTFS files found in input | Folder contains only `.md` files |

## WARNING codes

| Code | Default file context | Meaning | Example |
|------|----------------------|---------|---------|
| `GTFS-101` | `fare_attributes.txt` etc. | Legacy V1 fare file detected (ignored) | Provider still ships `fare_attributes.txt` alongside V2 fare files |
| `GTFS-102` | the affected file | Optional field has unexpected value | `routes.route_type` outside the documented enum |
| `GTFS-103` | the affected file | Duplicate primary key | Two rows in `stops.txt` with the same `stop_id` |
| `GTFS-104` | the affected file | Non-UTF-8 encoding detected | ISO-8859-1 in `stops.txt` |
| `GTFS-105` | the affected file | Empty optional file | `frequencies.txt` exists but has only a header |
| `GTFS-106` | the affected file | Deprecated field used | Field has been removed from current spec revision |
| `GTFS-107` | `agency.txt` / `stops.txt` | Inconsistent timezone usage | Agencies declare different timezones |

## INFO codes

| Code | Default file context | Meaning | Example |
|------|----------------------|---------|---------|
| `GTFS-201` | `locations.geojson` | GTFS-Flex detected | Feed contains booking rules and Flex stops |
| `GTFS-202` | `shapes.txt` | Shapes available | `shapes.txt` present and non-empty |
| `GTFS-203` | `translations.txt` | Multilingual translations present | Feed ships translations |
| `GTFS-204` | `pathways.txt` | Pathways available | Indoor station navigation supported |
| `GTFS-205` | `fare_leg_rules.txt` etc. | Fare V2 system detected | V2 fare model in use |
| `GTFS-206` | `attributions.txt` | Attributions present | Feed declares licensing/attribution data |

## Adding new codes

Add to `src/shared/Validation.mjs` (the `GTFS_CODES` dictionary). The severity is derived from the numeric range — no separate mapping needed. Document the new code in this file.
