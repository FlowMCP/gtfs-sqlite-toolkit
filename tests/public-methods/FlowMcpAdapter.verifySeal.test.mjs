import { describe, test, expect, afterEach } from '@jest/globals'
import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'
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


const buildSealedDb = ( { dbPath, metaTable } ) => {
    const { db } = SqliteBuilder.createDatabase( {
        dbPath,
        schema: { dummy: [ { name: 'id', type: 'TEXT' } ] }
    } )
    MetaWriter.writeMeta( { db, metaTable } )
    SqliteBuilder.close( { db } )
}


describe( 'FlowMcpAdapter.verifySeal', () => {
    test( 'returns sealed=true with full meta when qualitySeal=sqlite-gtfs', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-verifyseal-ok-' ) )
        const dbPath = join( tmpDir, 'sealed.db' )
        const meta = {
            qualitySeal:      'sqlite-gtfs',
            specUrl:          'https://gtfs.org/documentation/schedule/reference/',
            specRevision:     '2026-04-27',
            converterVersion: 'geo-gtfs-toolkit@0.1.0',
            sourceUrl:        'https://example.com/feed.zip',
            sourceHash:       'sha256:abcdef',
            buildDate:        '2026-05-21T12:00:00Z',
            rowCounts:        { agency: 1, stops: 5 },
            capabilities:     { basicLookup: true, routing: true },
            validationReport: { summary: { errorCount: 0, warningCount: 0, infoCount: 0 } }
        }
        buildSealedDb( { dbPath, metaTable: meta } )

        const result = FlowMcpAdapter.verifySeal( { dbPath } )

        expect( result.sealed ).toBe( true )
        expect( result.meta ).not.toBeNull()
        expect( result.meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( result.meta.specRevision ).toBe( '2026-04-27' )
        expect( result.meta.specUrl ).toBe( 'https://gtfs.org/documentation/schedule/reference/' )
        expect( result.meta.converterVersion ).toBe( 'geo-gtfs-toolkit@0.1.0' )
        expect( result.meta.capabilities.basicLookup ).toBe( true )
        expect( result.meta.rowCounts.stops ).toBe( 5 )
        expect( result.reason ).toBeUndefined()
    } )


    test( 'returns NO_SEAL when meta table lacks sqlite-gtfs seal', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-verifyseal-noseal-' ) )
        const dbPath = join( tmpDir, 'noseal.db' )
        const meta = {
            qualitySeal:  null,
            specRevision: '2026-04-27',
            capabilities: { basicLookup: true }
        }
        buildSealedDb( { dbPath, metaTable: meta } )

        const result = FlowMcpAdapter.verifySeal( { dbPath } )

        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'NO_SEAL' )
    } )


    test( 'returns NO_META when meta table is absent', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-verifyseal-nometa-' ) )
        const dbPath = join( tmpDir, 'nometa.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { dummy: [ { name: 'id', type: 'TEXT' } ] }
        } )
        SqliteBuilder.close( { db } )

        const result = FlowMcpAdapter.verifySeal( { dbPath } )

        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'NO_META' )
    } )


    test( 'returns DB_UNREADABLE when DB path cannot be opened', () => {
        const dbPath = '/nonexistent-dir-fmcp-verifyseal/missing.db'

        const result = FlowMcpAdapter.verifySeal( { dbPath } )

        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'DB_UNREADABLE' )
    } )


    test( 'throws when dbPath is missing', () => {
        expect( () => FlowMcpAdapter.verifySeal( {} ) ).toThrow( 'dbPath is required' )
    } )


    test( 'throws when dbPath is not a string', () => {
        expect( () => FlowMcpAdapter.verifySeal( { dbPath: 123 } ) ).toThrow( 'dbPath must be a string' )
    } )


    test( 'throws when dbPath is empty string', () => {
        expect( () => FlowMcpAdapter.verifySeal( { dbPath: '' } ) ).toThrow( 'dbPath must not be empty' )
    } )
} )
