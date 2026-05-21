import { GtfsSqliteConverter } from '../../src/GtfsSqliteConverter.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ZIP_PATH = join( __dirname, 'data', 'vbb-flex.zip' )
const DB_PATH = join( __dirname, 'data', 'vbb-flex.db' )


const main = async () => {
    if( !existsSync( ZIP_PATH ) ) {
        console.error( `Sample not found: ${ZIP_PATH}` )
        console.error( 'Download VBB Flex via Transitous: https://api.transitous.org/gtfs/' )
        process.exit( 1 )
    }

    console.log( `POC-4: VBB Flex (~38 KB, GTFS-Flex)` )
    const result = await GtfsSqliteConverter.start( {
        input: ZIP_PATH, inputType: 'zip', dbPath: DB_PATH, force: true,
        sourceUrl: 'https://api.transitous.org/gtfs/'
    } )
    console.log( `Status: ${result.status} | Seal: ${result.seal}` )
    console.log( `Capabilities.flexService: ${result.capabilities ? result.capabilities.flexService : 'n/a'}` )
    console.log( `Errors: ${result.report.errors.length} | Warnings: ${result.report.warnings.length} | Info: ${result.report.info.length}` )
}


main().catch( ( err ) => { console.error( err ); process.exit( 1 ) } )
