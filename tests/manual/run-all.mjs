import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )


const SCRIPTS = [
    { name: 'POC-1 SWU Ulm',    file: 'run-swu.mjs',         data: 'data/swu-ulm.zip' },
    { name: 'POC-2 gtfs.de FV', file: 'run-gtfs-de.mjs',     data: 'data/gtfs-de-fv.zip' },
    { name: 'POC-3 MobiData VVS', file: 'run-mobidata-bw.mjs', data: 'data/mobidata-vvs.zip' },
    { name: 'POC-4 VBB Flex',   file: 'run-vbb-flex.mjs',    data: 'data/vbb-flex.zip' }
]


SCRIPTS.forEach( ( s ) => {
    const dataPath = join( __dirname, s.data )
    const scriptPath = join( __dirname, s.file )
    console.log( `\n${'='.repeat( 60 )}` )
    console.log( `${s.name}` )
    console.log( '='.repeat( 60 ) )
    if( !existsSync( dataPath ) ) {
        console.log( `SKIPPED — data file missing: ${dataPath}` )
        return
    }
    try {
        execSync( `node ${scriptPath}`, { stdio: 'inherit' } )
    } catch ( err ) {
        console.log( `FAILED: ${err.message}` )
    }
} )
