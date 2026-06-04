import { ZipExtractor } from '../../shared/ZipExtractor.mjs'
import { FolderReader } from '../../shared/FolderReader.mjs'
import { CsvParser } from '../../shared/CsvParser.mjs'
import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../shared/MetaWriter.mjs'
import { Validation } from '../../shared/Validation.mjs'
import { InputDetector } from '../../shared/InputDetector.mjs'
import { ScheduleSpecValidator } from './ScheduleSpecValidator.mjs'
import { ScheduleForeignKeyChecker } from './ScheduleForeignKeyChecker.mjs'
import { ScheduleCapabilityDetector } from './ScheduleCapabilityDetector.mjs'
import { ScheduleMetadataSchema } from './ScheduleMetadataSchema.mjs'
import specReference, { SPEC_URL, SPEC_REVISION } from './spec/spec-reference.mjs'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extract as tarExtract } from 'tar'


const CONVERTER_VERSION = 'geo-gtfs-toolkit@0.1.0'


export class ScheduleConverter {
    static async run( { input, inputType = 'auto', force = false, dbPath, sourceUrl = null } ) {
        const resolvedType = inputType === 'auto'
            ? InputDetector.detect( { input } ).inputType
            : inputType
        const parsedFiles = await ScheduleConverter.#loadAndParse( { input, inputType: resolvedType } )
        const v = Validation.create()
        ScheduleSpecValidator.validate( { parsedFiles, validation: v } )
        ScheduleForeignKeyChecker.check( { parsedFiles, validation: v } )
        const report = v.report()

        if( report.errors.length > 0 && !force ) {
            return {
                status: false,
                dbPath: null,
                report,
                capabilities: null,
                seal: null,
                aborted: true
            }
        }

        const filesToWrite = force
            ? ScheduleConverter.#filterOutErrorFiles( { parsedFiles, errors: report.errors } )
            : parsedFiles

        const dbPathNew = `${dbPath}.new`
        const { db } = SqliteBuilder.createDatabase( {
            dbPath: dbPathNew,
            schema: ScheduleConverter.#buildSchema( { parsedFiles: filesToWrite } )
        } )

        filesToWrite.forEach( ( parsed, filename ) => {
            const tableName = ScheduleConverter.#tableNameFor( { filename } )
            if( !tableName ) return
            if( parsed.rows.length === 0 ) return
            SqliteBuilder.insertRows( { db, tableName, rows: parsed.rows } )
        } )

        const capabilities = ScheduleCapabilityDetector.detect( { parsedFiles: filesToWrite } )

        const seal = ScheduleMetadataSchema.computeSeal( {
            validationReport: report,
            forceUsed: force && report.errors.length > 0
        } )

        const meta = ScheduleMetadataSchema.buildMeta( {
            qualitySeal: seal,
            specUrl: SPEC_URL,
            specRevision: SPEC_REVISION,
            converterVersion: CONVERTER_VERSION,
            sourceUrl,
            sourceHash: null,
            buildDate: new Date().toISOString(),
            rowCounts: ScheduleConverter.#countRows( { parsedFiles: filesToWrite } ),
            capabilities,
            validationReport: {
                errors: report.summary.errorCount,
                warnings: report.summary.warningCount,
                info: report.summary.infoCount
            }
        } )
        MetaWriter.writeMeta( { db, metaTable: meta } )

        SqliteBuilder.close( { db } )
        SqliteBuilder.atomicSwap( { dbPathNew, dbPathFinal: dbPath } )

        return {
            status: true,
            dbPath,
            report,
            capabilities,
            seal,
            aborted: false
        }
    }


    static async #loadAndParse( { input, inputType } ) {
        const files = await ScheduleConverter.#extractFiles( { input, inputType } )
        const parsed = new Map()
        files.forEach( ( buffer, filename ) => {
            const result = CsvParser.parse( { buffer, filename } )
            parsed.set( filename, result )
        } )
        return parsed
    }


    static async #extractFiles( { input, inputType } ) {
        if( inputType === 'zip' ) {
            const { files } = await ZipExtractor.extractZipToBuffer( { zipPath: input } )
            return files
        }
        if( inputType === 'buffer' ) {
            const { files } = await ZipExtractor.extractZipBufferToFiles( { buffer: input } )
            return files
        }
        if( inputType === 'folder' ) {
            const { files } = FolderReader.readFolder( { folderPath: input } )
            return files
        }
        if( inputType === 'targz' ) {
            const tmpExtractDir = mkdtempSync( join( tmpdir(), 'gtfs-tar-' ) )
            try {
                await tarExtract( { file: input, cwd: tmpExtractDir } )
                const { files } = FolderReader.readFolder( { folderPath: tmpExtractDir } )
                return files
            } finally {
                rmSync( tmpExtractDir, { recursive: true, force: true } )
            }
        }
        if( inputType === 'targz-buffer' ) {
            throw new Error( 'targz-buffer not yet implemented — write buffer to tmp file first' )
        }
        throw new Error( `Unsupported inputType: ${inputType}` )
    }


    static #buildSchema( { parsedFiles } ) {
        const schema = {}
        parsedFiles.forEach( ( parsed, filename ) => {
            const tableName = ScheduleConverter.#tableNameFor( { filename } )
            if( !tableName ) return
            const fileSpec = specReference.files[ filename ]
            if( !fileSpec ) {
                schema[ tableName ] = parsed.headers.map( ( h ) => ( { name: h, type: 'TEXT' } ) )
                return
            }
            const typeByName = new Map()
            fileSpec.fields.forEach( ( f ) => typeByName.set( f.name, f.type ) )
            schema[ tableName ] = parsed.headers.map( ( h ) => ( {
                name: h,
                type: typeByName.get( h ) || 'TEXT'
            } ) )
        } )
        return schema
    }


    static #tableNameFor( { filename } ) {
        if( filename.endsWith( '.txt' ) ) {
            return filename.replace( /\.txt$/, '' )
        }
        if( filename === 'locations.geojson' ) {
            return null
        }
        return null
    }


    static #filterOutErrorFiles( { parsedFiles, errors } ) {
        const badFiles = new Set( errors.map( ( e ) => e.file ) )
        const filtered = new Map()
        parsedFiles.forEach( ( parsed, filename ) => {
            if( !badFiles.has( filename ) ) {
                filtered.set( filename, parsed )
            }
        } )
        return filtered
    }


    static #countRows( { parsedFiles } ) {
        const counts = {}
        parsedFiles.forEach( ( parsed, filename ) => {
            counts[ filename ] = parsed.rows.length
        } )
        return counts
    }
}
