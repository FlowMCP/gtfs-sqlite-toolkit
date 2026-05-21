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


describe( 'FlowMcpAdapter.getAvailableMethods', () => {
    test( 'returns all 5 methods when every capability is true', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-full-' ) )
        const dbPath = join( tmpDir, 'full.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        expect( methods.length ).toBe( 5 )
        const methodNames = methods.map( ( m ) => m.name )
        expect( methodNames ).toContain( 'searchStops' )
        expect( methodNames ).toContain( 'searchRoutes' )
        expect( methodNames ).toContain( 'getDepartures' )
        expect( methodNames ).toContain( 'getShapeForRoute' )
        expect( methodNames ).toContain( 'getFlexBookingRules' )
        expect( capabilities.basicLookup ).toBe( true )
    } )


    test( 'returns 2 methods when only basicLookup is true', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-basic-' ) )
        const dbPath = join( tmpDir, 'basic.db' )
        const caps = { ...FULL_CAPS }
        Object
            .keys( caps )
            .forEach( ( key ) => { caps[ key ] = false } )
        caps.basicLookup = true
        buildDbWithCaps( { dbPath, capabilities: caps } )

        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        expect( methods.length ).toBe( 2 )
        const names = methods.map( ( m ) => m.name )
        expect( names ).toContain( 'searchStops' )
        expect( names ).toContain( 'searchRoutes' )
    } )


    test( 'hides getShapeForRoute when shapesVisualization is false', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-noshapes-' ) )
        const dbPath = join( tmpDir, 'noshapes.db' )
        const caps = { ...FULL_CAPS, shapesVisualization: false }
        buildDbWithCaps( { dbPath, capabilities: caps } )

        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        const names = methods.map( ( m ) => m.name )
        expect( names ).not.toContain( 'getShapeForRoute' )
        expect( names ).toContain( 'searchStops' )
        expect( names ).toContain( 'getDepartures' )
    } )


    test( 'hides getFlexBookingRules when flexService is false', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-noflex-' ) )
        const dbPath = join( tmpDir, 'noflex.db' )
        const caps = { ...FULL_CAPS, flexService: false }
        buildDbWithCaps( { dbPath, capabilities: caps } )

        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        const names = methods.map( ( m ) => m.name )
        expect( names ).not.toContain( 'getFlexBookingRules' )
        expect( names ).toContain( 'searchStops' )
    } )


    test( 'capabilities object returns the 12 expected keys', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-shape-' ) )
        const dbPath = join( tmpDir, 'shape.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        const expectedKeys = [
            'basicLookup', 'routing', 'departures', 'shapesVisualization',
            'continuousBoarding', 'stationNavigation', 'fareCalculationV2',
            'fareTransfers', 'flexService', 'frequencyBased', 'multilingual',
            'licensedAttribution'
        ]
        expectedKeys
            .forEach( ( key ) => {
                expect( capabilities ).toHaveProperty( key )
            } )
    } )


    test( 'method entries contain sqlTemplate, params, outputSchema', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'fmcp-getmethods-entries-' ) )
        const dbPath = join( tmpDir, 'entries.db' )
        buildDbWithCaps( { dbPath, capabilities: FULL_CAPS } )

        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

        methods
            .forEach( ( method ) => {
                expect( method ).toHaveProperty( 'name' )
                expect( method ).toHaveProperty( 'sqlTemplate' )
                expect( method ).toHaveProperty( 'params' )
                expect( method ).toHaveProperty( 'outputSchema' )
                expect( method ).toHaveProperty( 'requiresCapabilities' )
            } )
    } )


    test( 'throws when dbPath is missing', () => {
        expect( () => FlowMcpAdapter.getAvailableMethods( {} ) ).toThrow( 'dbPath is required' )
    } )


    test( 'throws when dbPath is empty', () => {
        expect( () => FlowMcpAdapter.getAvailableMethods( { dbPath: '' } ) ).toThrow( 'dbPath must not be empty' )
    } )
} )
