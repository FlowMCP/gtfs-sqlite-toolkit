import { MetaWriter } from '../../shared/MetaWriter.mjs'
import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'


const PFLICHT_KEYS = [
    'qualitySeal',
    'specUrl',
    'specRevision',
    'converterVersion',
    'sourceUrl',
    'sourceHash',
    'buildDate',
    'rowCounts',
    'capabilities',
    'validationReport'
]


export class ScheduleMetadataSchema {
    static getPflichtKeys() {
        return [ ...PFLICHT_KEYS ]
    }


    static buildMeta( {
        qualitySeal,
        specUrl,
        specRevision,
        converterVersion,
        sourceUrl,
        sourceHash,
        buildDate,
        rowCounts,
        capabilities,
        validationReport
    } ) {
        return {
            qualitySeal,
            specUrl,
            specRevision,
            converterVersion,
            sourceUrl,
            sourceHash,
            buildDate,
            rowCounts,
            capabilities,
            validationReport
        }
    }


    static parseMeta( { dbPath } ) {
        const { db } = SqliteBuilder.openDatabase( { dbPath } )
        const raw = MetaWriter.readMeta( { db } )
        SqliteBuilder.close( { db } )
        return {
            qualitySeal: raw.qualitySeal,
            specUrl: raw.specUrl,
            specRevision: raw.specRevision,
            converterVersion: raw.converterVersion,
            sourceUrl: raw.sourceUrl,
            sourceHash: raw.sourceHash,
            buildDate: raw.buildDate,
            rowCounts: raw.rowCounts,
            capabilities: raw.capabilities,
            validationReport: raw.validationReport
        }
    }


    static parseCapabilities( { metaTable } ) {
        const caps = metaTable.capabilities
        if( !caps ) return null
        return typeof caps === 'string' ? JSON.parse( caps ) : caps
    }


    static parseRowCounts( { metaTable } ) {
        const rc = metaTable.rowCounts
        if( !rc ) return null
        return typeof rc === 'string' ? JSON.parse( rc ) : rc
    }


    static parseReport( { metaTable } ) {
        const rep = metaTable.validationReport
        if( !rep ) return null
        return typeof rep === 'string' ? JSON.parse( rep ) : rep
    }


    static verifySpecRevisionConsistency( { specRevision, specReferenceFilename } ) {
        const expected = `spec-reference-${specRevision}.json`
        if( specReferenceFilename !== expected ) {
            throw new Error( `Spec revision mismatch: meta.specRevision="${specRevision}" but file is "${specReferenceFilename}" (expected "${expected}")` )
        }
        return true
    }


    static computeSeal( { validationReport, forceUsed = false } ) {
        if( forceUsed ) return null
        if( validationReport.summary.errorCount > 0 ) return null
        if( validationReport.summary.warningCount > 0 ) return null
        return 'sqlite-gtfs'
    }
}
