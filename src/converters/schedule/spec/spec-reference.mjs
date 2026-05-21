import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const specReference = JSON.parse( readFileSync( join( __dirname, 'spec-reference-2026-04-27.json' ), 'utf-8' ) )


export const SPEC_REVISION = '2026-04-27'
export const SPEC_URL = 'https://gtfs.org/documentation/schedule/reference/'
export default specReference
