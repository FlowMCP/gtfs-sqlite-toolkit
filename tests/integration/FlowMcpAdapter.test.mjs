import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const FIXTURE_DIR = path.resolve( __dirname, '..', 'fixtures', 'synthetic-gtfs' )
const FIXTURE_DB = path.join( FIXTURE_DIR, 'synthetic-gtfs.db' )


let tmpDir = null


beforeAll( () => {
    if( !existsSync( FIXTURE_DB ) ) {
        execFileSync( 'node', [ 'build-fixture.mjs' ], { cwd: FIXTURE_DIR, stdio: 'inherit' } )
    }

    if( !existsSync( FIXTURE_DB ) ) {
        throw new Error( `Synthetic fixture DB missing after build attempt: ${FIXTURE_DB}` )
    }

    tmpDir = mkdtempSync( path.join( tmpdir(), 'fmcp-adapter-int-' ) )
} )


afterAll( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


function createNoSealDb( { fileName } ) {
    const dbPath = path.join( tmpDir, fileName )
    const db = new Database( dbPath )
    db.exec( 'CREATE TABLE meta( key TEXT PRIMARY KEY, value TEXT )' )
    db
        .prepare( 'INSERT INTO meta( key, value ) VALUES( ?, ? )' )
        .run( 'buildDate', '2026-05-21T00:00:00Z' )
    db.exec( 'CREATE TABLE stops( stop_id TEXT PRIMARY KEY, stop_name TEXT )' )
    db.close()

    return dbPath
}


describe( 'FlowMcpAdapter.verifySeal (integration — synthetic fixture)', () => {
    test( 'returns sealed=true with qualitySeal meta for sealed synthetic DB', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: FIXTURE_DB } )

        expect( result.sealed ).toBe( true )
        expect( result.meta ).not.toBeNull()
        expect( result.meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( result.meta.specRevision ).toBe( '2026-04-27' )
        expect( typeof result.meta.capabilities ).toBe( 'object' )
        expect( result.meta.capabilities.basicLookup ).toBe( true )
        expect( result.reason ).toBeUndefined()
    } )


    test( 'returns sealed=false with reason NO_SEAL for plain SQLite without qualitySeal', () => {
        const noSealPath = createNoSealDb( { fileName: 'no-seal.db' } )

        const result = FlowMcpAdapter.verifySeal( { dbPath: noSealPath } )

        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'NO_SEAL' )
    } )


    test( 'returns sealed=false with reason DB_UNREADABLE for nonexistent path', () => {
        const missingPath = path.join( tmpDir, 'does-not-exist', 'missing.db' )

        const result = FlowMcpAdapter.verifySeal( { dbPath: missingPath } )

        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'DB_UNREADABLE' )
    } )
} )


describe( 'FlowMcpAdapter.getAvailableMethods (integration — synthetic fixture)', () => {
    test( 'returns the six methods enabled by synthetic capabilities', () => {
        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath: FIXTURE_DB } )

        const names = methods.map( ( m ) => m.name )

        expect( names ).toContain( 'searchStops' )
        expect( names ).toContain( 'searchRoutes' )
        expect( names ).toContain( 'getDepartures' )
        expect( names ).toContain( 'getShapeForRoute' )
        expect( names ).toContain( 'nearPoint' )
        expect( names ).toContain( 'inBoundingBox' )
        expect( names.length ).toBe( 6 )

        expect( typeof capabilities ).toBe( 'object' )
        expect( capabilities.basicLookup ).toBe( true )
    } )


    test( 'capabilities map has 12 keys with 4 true and 8 false (synthetic fixture profile)', () => {
        const { capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath: FIXTURE_DB } )

        const keys = Object.keys( capabilities )
        expect( keys.length ).toBe( 12 )

        const trueKeys = keys.filter( ( k ) => capabilities[ k ] === true )
        const falseKeys = keys.filter( ( k ) => capabilities[ k ] === false )

        expect( trueKeys.length ).toBe( 4 )
        expect( falseKeys.length ).toBe( 8 )
        expect( trueKeys.sort() ).toEqual( [ 'basicLookup', 'departures', 'routing', 'shapesVisualization' ] )
    } )


    test( 'does NOT include getFlexBookingRules (synthetic fixture has no flex data)', () => {
        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath: FIXTURE_DB } )

        const names = methods.map( ( m ) => m.name )

        expect( names ).not.toContain( 'getFlexBookingRules' )
    } )
} )


describe( 'FlowMcpAdapter.buildToolDefinitions (integration — synthetic fixture)', () => {
    test( 'every tool name is prefixed with the given namespace', () => {
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'test' } )

        expect( tools.length ).toBeGreaterThan( 0 )

        tools
            .forEach( ( tool ) => {
                expect( tool.name.startsWith( 'test.' ) ).toBe( true )
            } )
    } )


    test( 'tools count matches getAvailableMethods count', () => {
        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath: FIXTURE_DB } )
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'test' } )

        expect( tools.length ).toBe( methods.length )
    } )


    test( 'each tool exposes spec-v4 fields (name, description, inputSchema)', () => {
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'test' } )

        tools
            .forEach( ( tool ) => {
                expect( tool ).toHaveProperty( 'name' )
                expect( tool ).toHaveProperty( 'description' )
                expect( tool ).toHaveProperty( 'inputSchema' )
                expect( tool.inputSchema ).toHaveProperty( 'type', 'object' )
                expect( tool.inputSchema ).toHaveProperty( 'properties' )
                expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
            } )
    } )


    test( 'expected auto-tool names are present with namespace gtfsde', () => {
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'gtfsde' } )

        const names = tools.map( ( t ) => t.name )

        expect( names ).toContain( 'gtfsde.searchStops' )
        expect( names ).toContain( 'gtfsde.searchRoutes' )
        expect( names ).toContain( 'gtfsde.getDepartures' )
        expect( names ).toContain( 'gtfsde.getShapeForRoute' )
        expect( names ).not.toContain( 'gtfsde.getFlexBookingRules' )
    } )
} )
