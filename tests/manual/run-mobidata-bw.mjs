import { GtfsSqliteConverter } from '../../src/GtfsSqliteConverter.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ZIP_PATH = join( __dirname, 'data', 'mobidata-vvs.zip' )
const DB_PATH = join( __dirname, 'data', 'mobidata-vvs.db' )


const main = async () => {
    if( !existsSync( ZIP_PATH ) ) {
        console.error( `Sample not found: ${ZIP_PATH}` )
        console.error( 'Download VVS from MobiData-BW CKAN: https://www.mobidata-bw.de/dataset/vvs' )
        process.exit( 1 )
    }

    console.log( `POC-3: MobiData-BW VVS` )
    const result = await GtfsSqliteConverter.start( {
        input: ZIP_PATH, inputType: 'zip', dbPath: DB_PATH, force: true,
        sourceUrl: 'https://www.mobidata-bw.de/dataset/vvs'
    } )
    console.log( `Status: ${result.status} | Seal: ${result.seal}` )
    console.log( `Errors: ${result.report.errors.length} | Warnings: ${result.report.warnings.length}` )

    const { db } = SqliteBuilder.openDatabase( { dbPath: DB_PATH } )
    const counts = {
        stops:  db.prepare( 'SELECT COUNT(*) AS n FROM stops' ).get().n,
        routes: db.prepare( 'SELECT COUNT(*) AS n FROM routes' ).get().n
    }
    console.log( `Stops: ${counts.stops} | Routes: ${counts.routes}` )
    SqliteBuilder.close( { db } )
}


main().catch( ( err ) => { console.error( err ); process.exit( 1 ) } )
