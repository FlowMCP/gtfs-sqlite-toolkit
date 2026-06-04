# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-04

Geo-standard alignment and FeatureCollection output (Memo 100).

### Added
- Spatial methods returning normalized lon-first **RFC-7946 FeatureCollections**.
- `FlowMcpAdapter` for FlowMCP CLI integration, with a synthetic Mini-GTFS test fixture.

### Changed
- Aligned to the geo add-on standard (naming, English README).
- Moved `better-sqlite3` to `peerDependencies` for consumer compatibility.
- **Renamed repository** `gtfs-sqlite-toolkit` → `geo-gtfs-toolkit` (Memo 106).
  The old URL redirects; the npm package name is `geo-gtfs-toolkit`.

### Fixed
- CI no longer fails the build on a Codecov upload error (best-effort coverage upload).

## [0.1.0] - 2026-05-21

Initial release (Memo 051).

### Added
- Convert **GTFS Schedule feeds (CSV in ZIP) to queryable SQLite** with a quality
  seal, capability detection, and reusable default queries.
