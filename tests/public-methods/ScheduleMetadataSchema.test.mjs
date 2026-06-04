import { describe, test, expect, afterEach } from '@jest/globals'
import { ScheduleMetadataSchema } from '../../src/converters/schedule/ScheduleMetadataSchema.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../src/shared/MetaWriter.mjs'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'ScheduleMetadataSchema', () => {
    test( 'getPflichtKeys returns 10 required keys', () => {
        const keys = ScheduleMetadataSchema.getPflichtKeys()
        expect( keys.length ).toBe( 10 )
        expect( keys ).toContain( 'qualitySeal' )
        expect( keys ).toContain( 'specRevision' )
        expect( keys ).toContain( 'specUrl' )
    } )


    test( 'buildMeta returns object with all keys', () => {
        const meta = ScheduleMetadataSchema.buildMeta( {
            qualitySeal: 'sqlite-gtfs',
            specUrl: 'https://gtfs.org/x',
            specRevision: '2026-04-27',
            converterVersion: 'geo-gtfs-toolkit@0.1.0',
            sourceUrl: null,
            sourceHash: null,
            buildDate: '2026-05-21T00:00:00Z',
            rowCounts: { agency: 1 },
            capabilities: { basicLookup: true },
            validationReport: { errors: 0, warnings: 0, info: 0 }
        } )
        expect( meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( meta.specRevision ).toBe( '2026-04-27' )
        expect( meta.rowCounts.agency ).toBe( 1 )
    } )


    test( 'computeSeal returns sqlite-gtfs for INFO-only report', () => {
        const report = { summary: { errorCount: 0, warningCount: 0, infoCount: 3 } }
        expect( ScheduleMetadataSchema.computeSeal( { validationReport: report } ) ).toBe( 'sqlite-gtfs' )
    } )


    test( 'computeSeal returns null when warnings present', () => {
        const report = { summary: { errorCount: 0, warningCount: 1, infoCount: 0 } }
        expect( ScheduleMetadataSchema.computeSeal( { validationReport: report } ) ).toBeNull()
    } )


    test( 'computeSeal returns null when errors present', () => {
        const report = { summary: { errorCount: 1, warningCount: 0, infoCount: 0 } }
        expect( ScheduleMetadataSchema.computeSeal( { validationReport: report } ) ).toBeNull()
    } )


    test( 'computeSeal returns null when forceUsed=true even on clean report', () => {
        const report = { summary: { errorCount: 0, warningCount: 0, infoCount: 0 } }
        expect( ScheduleMetadataSchema.computeSeal( { validationReport: report, forceUsed: true } ) ).toBeNull()
    } )


    test( 'verifySpecRevisionConsistency passes for matching', () => {
        expect( ScheduleMetadataSchema.verifySpecRevisionConsistency( {
            specRevision: '2026-04-27',
            specReferenceFilename: 'spec-reference-2026-04-27.json'
        } ) ).toBe( true )
    } )


    test( 'verifySpecRevisionConsistency throws on mismatch', () => {
        expect( () => ScheduleMetadataSchema.verifySpecRevisionConsistency( {
            specRevision: '2026-04-27',
            specReferenceFilename: 'spec-reference-2026-01-01.json'
        } ) ).toThrow( 'Spec revision mismatch' )
    } )


    test( 'parseMeta round-trips through SQLite', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-meta-' ) )
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema: { x: [ { name: 'id', type: 'TEXT' } ] } } )
        MetaWriter.writeMeta( { db, metaTable: {
            qualitySeal: 'sqlite-gtfs',
            specRevision: '2026-04-27',
            capabilities: { basicLookup: true }
        } } )
        SqliteBuilder.close( { db } )
        const meta = ScheduleMetadataSchema.parseMeta( { dbPath } )
        expect( meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( meta.specRevision ).toBe( '2026-04-27' )
        expect( meta.capabilities.basicLookup ).toBe( true )
    } )


    test( 'parseCapabilities returns null if not set', () => {
        expect( ScheduleMetadataSchema.parseCapabilities( { metaTable: {} } ) ).toBeNull()
    } )


    test( 'parseRowCounts handles JSON string', () => {
        const result = ScheduleMetadataSchema.parseRowCounts( { metaTable: { rowCounts: '{"agency":4}' } } )
        expect( result.agency ).toBe( 4 )
    } )
} )
