import { GtfsSqliteConverter } from '../../src/GtfsSqliteConverter.mjs'
import { ScheduleMetadataSchema } from '../../src/converters/schedule/ScheduleMetadataSchema.mjs'
import { ScheduleDefaultMethods } from '../../src/converters/schedule/ScheduleDefaultMethods.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ZIP_PATH = join( __dirname, 'data', 'gtfs-de-fv.zip' )
const DB_PATH = join( __dirname, 'data', 'gtfs-de-fv.db' )


const main = async () => {
    if( !existsSync( ZIP_PATH ) ) {
        console.error( `Sample not found: ${ZIP_PATH}` )
        console.error( 'Download: curl -sL -o tests/manual/data/gtfs-de-fv.zip https://download.gtfs.de/germany/fv_free/latest.zip' )
        process.exit( 1 )
    }

    console.log( `POC-2: gtfs.de FV (~441 KB)` )
    console.log( `Source: ${ZIP_PATH}` )
    console.log( `DB:     ${DB_PATH}` )
    console.log( '' )

    const t0 = Date.now()
    const result = await GtfsSqliteConverter.start( {
        input: ZIP_PATH,
        inputType: 'zip',
        dbPath: DB_PATH,
        sourceUrl: 'https://download.gtfs.de/germany/fv_free/latest.zip'
    } )
    const ms = Date.now() - t0

    console.log( `Conversion: ${ms} ms` )
    console.log( `Status:     ${result.status}` )
    console.log( `Seal:       ${result.seal}` )
    console.log( `Errors:     ${result.report.errors.length}` )
    console.log( `Warnings:   ${result.report.warnings.length}` )
    console.log( `Info:       ${result.report.info.length}` )
    console.log( '' )

    if( result.report.errors.length > 0 ) {
        console.log( 'First 5 errors:' )
        result.report.errors.slice( 0, 5 ).forEach( ( e ) => {
            console.log( `  - [${e.code}] ${e.file}: ${e.message}` )
        } )
        console.log( '' )
    }

    let finalResult = result
    if( !result.status ) {
        console.log( 'Strict mode aborted. Retrying with force=true...' )
        finalResult = await GtfsSqliteConverter.start( {
            input: ZIP_PATH,
            inputType: 'zip',
            dbPath: DB_PATH,
            sourceUrl: 'https://download.gtfs.de/germany/fv_free/latest.zip',
            force: true
        } )
        console.log( `Force-Mode Status:    ${finalResult.status}` )
        console.log( `Force-Mode Seal:      ${finalResult.seal}` )
        console.log( '' )
    }

    if( !finalResult.status ) {
        console.log( 'Conversion failed even in force mode.' )
        return
    }

    result.capabilities = finalResult.capabilities

    console.log( 'Capabilities:' )
    Object.entries( result.capabilities ).forEach( ( [ k, v ] ) => {
        console.log( `  ${v ? '✓' : '·'} ${k}` )
    } )
    console.log( '' )

    const meta = ScheduleMetadataSchema.parseMeta( { dbPath: DB_PATH } )
    console.log( `Meta.specRevision:    ${meta.specRevision}` )
    console.log( `Meta.qualitySeal:     ${meta.qualitySeal}` )
    console.log( `Meta.rowCounts:       ${JSON.stringify( meta.rowCounts )}` )
    console.log( '' )

    const methods = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities: result.capabilities } )
    console.log( `Available methods (${methods.length}):` )
    methods.forEach( ( m ) => console.log( `  - ${m.name}` ) )
    console.log( '' )

    const { db } = SqliteBuilder.openDatabase( { dbPath: DB_PATH } )
    const stopSample = db.prepare( 'SELECT stop_id, stop_name FROM stops LIMIT 5' ).all()
    console.log( 'Sample stops:' )
    stopSample.forEach( ( s ) => console.log( `  ${s.stop_id} — ${s.stop_name}` ) )
    const routeCount = db.prepare( 'SELECT COUNT(*) AS n FROM routes' ).get()
    console.log( `Total routes: ${routeCount.n}` )
    SqliteBuilder.close( { db } )
}


main().catch( ( err ) => {
    console.error( 'POC failed:', err )
    process.exit( 1 )
} )
