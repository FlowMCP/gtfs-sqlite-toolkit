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


const FULL_CAPS = {
    basicLookup:         true,
    routing:             true,
    departures:          true,
    shapesVisualization: true,
    continuousBoarding:  true,
    stationNavigation:   true,
    fareCalculationV2:   true,
    fareTransfers:       true,
    flexService:         true,
    frequencyBased:      true,
    multilingual:        true,
    licensedAttribution: true
}


const buildDbWithCaps = ( { dbPath, capabilities } ) => {
    const { db } = SqliteBuilder.createDatabase( {
        dbPath,
        schema: { dummy: [ { name: 'id', type: 'TEXT' } ] }
    } )
    MetaWriter.writeMeta( { db, metaTable: {
        qualitySeal:  'sqlite-gtfs',
        specRevision: '2026-04-27',
        capabilities
    } } )
    SqliteBuilder.close( { db } )
}


describe( 'FlowMcpAdapter.buildToolDefinitions', () => {
    test( 'returns 5 tools when all capabilities are enabled', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-full-' ) )
        const dbPath = join( tmpDir, 'full.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )

        expect( tools.length ).toBe( 5 )
    } )


    test( 'every tool name is prefixed with the namespace', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-prefix-' ) )
        const dbPath = join( tmpDir, 'prefix.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )

        tools
            .forEach( ( tool ) => {
                expect( tool.name.startsWith( 'gtfsde.' ) ).toBe( true )
            } )
        const names = tools.map( ( t ) => t.name )
        expect( names ).toContain( 'gtfsde.searchStops' )
        expect( names ).toContain( 'gtfsde.searchRoutes' )
        expect( names ).toContain( 'gtfsde.getDepartures' )
        expect( names ).toContain( 'gtfsde.getShapeForRoute' )
        expect( names ).toContain( 'gtfsde.getFlexBookingRules' )
    } )


    test( 'tool shape exposes the six required keys', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-shape-' ) )
        const dbPath = join( tmpDir, 'shape.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )

        const tool = tools[ 0 ]
        expect( tool ).toHaveProperty( 'name' )
        expect( tool ).toHaveProperty( 'description' )
        expect( tool ).toHaveProperty( 'inputSchema' )
        expect( tool ).toHaveProperty( 'outputSchema' )
        expect( tool ).toHaveProperty( 'requiresCapabilities' )
        expect( tool ).toHaveProperty( 'sqlTemplate' )
        expect( tool.inputSchema.type ).toBe( 'object' )
        expect( tool.inputSchema ).toHaveProperty( 'properties' )
        expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
    } )


    test( 'inputSchema mirrors params with type, description, required array', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-inputschema-' ) )
        const dbPath = join( tmpDir, 'input.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )

        const searchStops = tools.find( ( t ) => t.name === 'gtfsde.searchStops' )
        expect( searchStops.inputSchema.properties.query.type ).toBe( 'string' )
        expect( typeof searchStops.inputSchema.properties.query.description ).toBe( 'string' )
        expect( searchStops.inputSchema.required ).toContain( 'query' )
        expect( searchStops.inputSchema.required ).not.toContain( 'limit' )
    } )


    test( 'capability gating removes corresponding tool', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-gating-' ) )
        const dbPath = join( tmpDir, 'gating.db' )
        const caps = { ...FULL_CAPS, shapesVisualization: false }
        buildDbWithCaps( { dbPath, capabilities: caps } )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'gtfsde' } )

        const names = tools.map( ( t ) => t.name )
        expect( names ).not.toContain( 'gtfsde.getShapeForRoute' )
        expect( names ).toContain( 'gtfsde.searchStops' )
    } )


    test( 'throws when namespace fails the lowercase-hyphen pattern', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-badns-' ) )
        const dbPath = join( tmpDir, 'badns.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        expect( () => FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'Bad Name' } ) ).toThrow( /namespace must match/ )
    } )


    test( 'throws when dbPath is missing', () => {
        expect( () => FlowMcpAdapter.buildToolDefinitions( { namespace: 'gtfsde' } ) ).toThrow( 'dbPath is required' )
    } )


    test( 'throws when namespace is missing', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-buildtools-nons-' ) )
        const dbPath = join( tmpDir, 'nons.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        expect( () => FlowMcpAdapter.buildToolDefinitions( { dbPath } ) ).toThrow( 'namespace is required' )
    } )
} )
