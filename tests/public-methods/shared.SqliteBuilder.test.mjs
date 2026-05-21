import { describe, test, expect, afterEach } from '@jest/globals'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { existsSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


const setupTmpDir = () => {
    tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-test-' ) )
    return tmpDir
}


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'SqliteBuilder', () => {
    test( 'createDatabase creates file and tables', () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'test.db' )
        const schema = {
            agency: [
                { name: 'agency_id', type: 'TEXT PRIMARY KEY' },
                { name: 'agency_name', type: 'TEXT' }
            ]
        }
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
        expect( existsSync( dbPath ) ).toBe( true )
        const tables = db.prepare( "SELECT name FROM sqlite_master WHERE type='table'" ).all()
        expect( tables.some( ( t ) => t.name === 'agency' ) ).toBe( true )
        SqliteBuilder.close( { db } )
    } )


    test( 'insertRows persists data', () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'test.db' )
        const schema = {
            agency: [
                { name: 'agency_id', type: 'TEXT PRIMARY KEY' },
                { name: 'agency_name', type: 'TEXT' }
            ]
        }
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
        const { inserted } = SqliteBuilder.insertRows( {
            db,
            tableName: 'agency',
            rows: [
                { agency_id: 'DB', agency_name: 'Deutsche Bahn' },
                { agency_id: 'SWU', agency_name: 'SWU Ulm' }
            ]
        } )
        expect( inserted ).toBe( 2 )
        const count = db.prepare( 'SELECT COUNT(*) AS n FROM agency' ).get()
        expect( count.n ).toBe( 2 )
        SqliteBuilder.close( { db } )
    } )


    test( 'insertRows with empty array returns 0', () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        const { inserted } = SqliteBuilder.insertRows( { db, tableName: 'x', rows: [] } )
        expect( inserted ).toBe( 0 )
        SqliteBuilder.close( { db } )
    } )


    test( 'createFts5Index creates FTS table', () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { stops: [ { name: 'stop_id', type: 'TEXT' }, { name: 'stop_name', type: 'TEXT' } ] }
        } )
        SqliteBuilder.insertRows( { db, tableName: 'stops', rows: [
            { stop_id: '1', stop_name: 'Hauptbahnhof' },
            { stop_id: '2', stop_name: 'Marktplatz' }
        ] } )
        const { ftsTable } = SqliteBuilder.createFts5Index( {
            db,
            tableName: 'stops',
            columns: [ 'stop_name' ]
        } )
        expect( ftsTable ).toBe( 'stops_fts' )
        const matches = db.prepare( "SELECT * FROM stops_fts WHERE stop_name MATCH 'Hauptbahnhof'" ).all()
        expect( matches.length ).toBeGreaterThan( 0 )
        SqliteBuilder.close( { db } )
    } )


    test( 'atomicSwap renames db file', () => {
        setupTmpDir()
        const dbPathNew = join( tmpDir, 'test.db.new' )
        const dbPathFinal = join( tmpDir, 'test.db' )
        const { db } = SqliteBuilder.createDatabase( {
            dbPath: dbPathNew,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        SqliteBuilder.close( { db } )
        const { dbPath } = SqliteBuilder.atomicSwap( { dbPathNew, dbPathFinal } )
        expect( dbPath ).toBe( dbPathFinal )
        expect( existsSync( dbPathFinal ) ).toBe( true )
        expect( existsSync( dbPathNew ) ).toBe( false )
    } )


    test( 'atomicSwap throws if source missing', () => {
        setupTmpDir()
        expect( () => SqliteBuilder.atomicSwap( {
            dbPathNew: join( tmpDir, 'missing.db' ),
            dbPathFinal: join( tmpDir, 'final.db' )
        } ) ).toThrow( 'Source DB does not exist' )
    } )


    test( 'openDatabase opens existing database', () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'test.db' )
        const { db: db1 } = SqliteBuilder.createDatabase( {
            dbPath,
            schema: { x: [ { name: 'id', type: 'TEXT' } ] }
        } )
        SqliteBuilder.close( { db: db1 } )
        const { db: db2 } = SqliteBuilder.openDatabase( { dbPath } )
        const tables = db2.prepare( "SELECT name FROM sqlite_master WHERE type='table'" ).all()
        expect( tables.some( ( t ) => t.name === 'x' ) ).toBe( true )
        SqliteBuilder.close( { db: db2 } )
    } )
} )
