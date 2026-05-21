// Re-exports the active GTFS Schedule spec-reference snapshot.
//
// Calibrated against the official GTFS Schedule Reference:
//   https://gtfs.org/documentation/schedule/reference/
// Source-of-truth Markdown (Apache 2.0):
//   https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md
//
// Active revision: 2026-04-27  (downloaded on 2026-05-21)
// Active JSON:     ./spec-reference-2026-04-27.json
//
// To track a new GTFS revision: drop a new reference.md, run
//   node tools/build-spec-reference.mjs /path/to/reference.md
// to generate a new spec-reference-YYYY-MM-DD.json, then update both the
// import path below and the SPEC_REVISION constant.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const specReference = JSON.parse( readFileSync( join( __dirname, 'spec-reference-2026-04-27.json' ), 'utf-8' ) )


export const SPEC_REVISION = '2026-04-27'
export const SPEC_URL = 'https://gtfs.org/documentation/schedule/reference/'
export const SPEC_SOURCE_MARKDOWN = 'https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md'
export const SPEC_DOWNLOADED_AT = '2026-05-21'
export default specReference
