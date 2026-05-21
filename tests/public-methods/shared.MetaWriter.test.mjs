import { describe, test, expect, afterEach } from '@jest/globals'
import { MetaWriter } from '../../src/shared/MetaWriter.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
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


describe( 'MetaWriter', () => {
    test( 'writes and reads back simple key-value pairs', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-meta-' ) )
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        MetaWriter.writeMeta( { db, metaTable: {
            qualitySeal: 'sqlite-gtfs',
            specUrl: 'https://gtfs.org/documentation/schedule/reference/',
            specRevision: '2026-04-27'
        } } )
        const meta = MetaWriter.readMeta( { db } )
        expect( meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( meta.specRevision ).toBe( '2026-04-27' )
        SqliteBuilder.close( { db } )
    } )


    test( 'serializes object values as JSON', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-meta-' ) )
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        MetaWriter.writeMeta( { db, metaTable: {
            rowCounts: { agency: 4, stops: 12567 },
            capabilities: { basicLookup: true, routing: false }
        } } )
        const meta = MetaWriter.readMeta( { db } )
        expect( meta.rowCounts ).toEqual( { agency: 4, stops: 12567 } )
        expect( meta.capabilities.basicLookup ).toBe( true )
        SqliteBuilder.close( { db } )
    } )


    test( 'handles null values', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-meta-' ) )
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        MetaWriter.writeMeta( { db, metaTable: { qualitySeal: null } } )
        const meta = MetaWriter.readMeta( { db } )
        expect( meta.qualitySeal ).toBeNull()
        SqliteBuilder.close( { db } )
    } )


    test( 'overwrites existing keys (INSERT OR REPLACE)', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-meta-' ) )
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        MetaWriter.writeMeta( { db, metaTable: { specRevision: '2026-01-01' } } )
        MetaWriter.writeMeta( { db, metaTable: { specRevision: '2026-04-27' } } )
        const meta = MetaWriter.readMeta( { db } )
        expect( meta.specRevision ).toBe( '2026-04-27' )
        SqliteBuilder.close( { db } )
    } )
} )
