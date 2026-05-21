import { GtfsSqliteConverter } from '../../src/GtfsSqliteConverter.mjs'
import { ScheduleDefaultMethods } from '../../src/converters/schedule/ScheduleDefaultMethods.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ZIP_PATH = join( __dirname, 'data', 'swu-ulm.zip' )
const DB_PATH = join( __dirname, 'data', 'swu-ulm.db' )


const main = async () => {
    if( !existsSync( ZIP_PATH ) ) {
        console.error( `Sample not found: ${ZIP_PATH}` )
        console.error( 'Download from MobiData-BW CKAN: https://www.mobidata-bw.de/dataset/swu-stadtwerke-ulm' )
        process.exit( 1 )
    }

    console.log( `POC-1: SWU Ulm (~1.1 MB, CC0)` )
    const t0 = Date.now()
    const result = await GtfsSqliteConverter.start( {
        input: ZIP_PATH, inputType: 'zip', dbPath: DB_PATH,
        sourceUrl: 'https://www.mobidata-bw.de/dataset/swu-stadtwerke-ulm'
    } )
    const ms = Date.now() - t0
    console.log( `Conversion: ${ms} ms | Status: ${result.status} | Seal: ${result.seal}` )
    console.log( `Errors: ${result.report.errors.length} | Warnings: ${result.report.warnings.length} | Info: ${result.report.info.length}` )

    if( !result.status ) return

    const methods = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities: result.capabilities } )
    console.log( `Available methods: ${methods.map( ( m ) => m.name ).join( ', ' )}` )

    const { db } = SqliteBuilder.openDatabase( { dbPath: DB_PATH } )
    const stopCount = db.prepare( 'SELECT COUNT(*) AS n FROM stops' ).get()
    const routeCount = db.prepare( 'SELECT COUNT(*) AS n FROM routes' ).get()
    console.log( `Stops: ${stopCount.n} | Routes: ${routeCount.n}` )
    SqliteBuilder.close( { db } )
}


main().catch( ( err ) => { console.error( err ); process.exit( 1 ) } )
