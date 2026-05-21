import { GtfsSqliteConverter } from '../../../src/index.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const EXPECTED_TRUE_CAPABILITIES = [
    'basicLookup',
    'routing',
    'departures',
    'shapesVisualization'
]
const EXPECTED_SEAL = 'sqlite-gtfs'


async function main() {
    const sourceDir = path.join( __dirname, 'source' )
    const dbPath = path.join( __dirname, 'synthetic-gtfs.db' )

    console.log( '[build-fixture] Reading source CSVs from:', sourceDir )
    console.log( '[build-fixture] Target DB path:', dbPath )
    console.log( '[build-fixture] Converting (gtfsSpec=schedule, inputType=folder)...' )

    const result = await GtfsSqliteConverter.start( {
        input: sourceDir,
        inputType: 'folder',
        dbPath,
        gtfsSpec: 'schedule',
        force: false,
        sourceUrl: null
    } )

    if( !result.status ) {
        console.error( '[build-fixture] FAIL — converter aborted' )
        console.error( '[build-fixture] report:', JSON.stringify( result.report, null, 2 ) )
        process.exit( 1 )
    }

    console.log( '[build-fixture] Conversion OK — verifying seal + capabilities...' )

    const db = new Database( dbPath, { readonly: true } )
    const sealRow = db
        .prepare( "SELECT value FROM meta WHERE key = 'qualitySeal'" )
        .get()
    const capsRow = db
        .prepare( "SELECT value FROM meta WHERE key = 'capabilities'" )
        .get()
    db.close()

    const seal = sealRow ? sealRow.value : null
    if( seal !== EXPECTED_SEAL ) {
        console.error( `[build-fixture] SEAL MISMATCH — expected "${EXPECTED_SEAL}", got "${seal}"` )
        process.exit( 1 )
    }
    console.log( '[build-fixture] qualitySeal =', seal )

    const capabilities = capsRow ? JSON.parse( capsRow.value ) : null
    if( !capabilities ) {
        console.error( '[build-fixture] capabilities missing from meta table' )
        process.exit( 1 )
    }

    const failures = []
    EXPECTED_TRUE_CAPABILITIES
        .forEach( ( key ) => {
            if( capabilities[ key ] !== true ) {
                failures.push( `Expected ${key} = true, got ${capabilities[ key ]}` )
            }
        } )
    Object
        .keys( capabilities )
        .forEach( ( key ) => {
            if( EXPECTED_TRUE_CAPABILITIES.includes( key ) ) { return }
            if( capabilities[ key ] !== false ) {
                failures.push( `Expected ${key} = false, got ${capabilities[ key ]}` )
            }
        } )

    if( failures.length > 0 ) {
        console.error( '[build-fixture] CAPABILITIES MISMATCH:' )
        failures.forEach( ( msg ) => console.error( '  -', msg ) )
        process.exit( 1 )
    }

    const activatedKeys = Object
        .entries( capabilities )
        .filter( ( [ , v ] ) => v === true )
        .map( ( [ k ] ) => k )

    console.log( '[build-fixture] Activated capabilities (4 of 12):' )
    activatedKeys.forEach( ( key ) => console.log( '  -', key ) )

    console.log( '[build-fixture] DONE — synthetic-gtfs.db is ready at:', dbPath )
    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[build-fixture] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
