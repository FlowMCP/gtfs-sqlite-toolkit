import { describe, test, expect } from '@jest/globals'
import { ScheduleDefaultMethods } from '../../src/converters/schedule/ScheduleDefaultMethods.mjs'


describe( 'ScheduleDefaultMethods', () => {
    test( 'getAllMethods returns 5 methods', () => {
        const methods = ScheduleDefaultMethods.getAllMethods()
        expect( methods.length ).toBe( 5 )
        const names = methods.map( ( m ) => m.name )
        expect( names ).toEqual( [
            'searchStops',
            'searchRoutes',
            'getDepartures',
            'getShapeForRoute',
            'getFlexBookingRules'
        ] )
    } )


    test( 'every method has sqlTemplate, params and outputSchema', () => {
        ScheduleDefaultMethods.getAllMethods().forEach( ( m ) => {
            expect( typeof m.sqlTemplate ).toBe( 'string' )
            expect( m.sqlTemplate.length ).toBeGreaterThan( 0 )
            expect( typeof m.params ).toBe( 'object' )
            expect( typeof m.outputSchema ).toBe( 'object' )
        } )
    } )


    test( 'getMethodsForCapabilities filters by required caps', () => {
        const caps = { basicLookup: true, routing: false, departures: false, flexService: false, shapesVisualization: false }
        const result = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities: caps } )
        const names = result.map( ( m ) => m.name )
        expect( names ).toContain( 'searchStops' )
        expect( names ).toContain( 'searchRoutes' )
        expect( names ).not.toContain( 'getDepartures' )
        expect( names ).not.toContain( 'getShapeForRoute' )
        expect( names ).not.toContain( 'getFlexBookingRules' )
    } )


    test( 'getMethodsForCapabilities returns all when all caps true', () => {
        const allTrue = {
            basicLookup: true, routing: true, departures: true,
            shapesVisualization: true, flexService: true
        }
        const result = ScheduleDefaultMethods.getMethodsForCapabilities( { capabilities: allTrue } )
        expect( result.length ).toBe( 5 )
    } )


    test( 'getMethodByName returns specific method', () => {
        const m = ScheduleDefaultMethods.getMethodByName( { name: 'searchStops' } )
        expect( m.name ).toBe( 'searchStops' )
        expect( m.requiresCapabilities ).toContain( 'basicLookup' )
    } )


    test( 'getMethodByName throws on unknown', () => {
        expect( () => ScheduleDefaultMethods.getMethodByName( { name: 'foo' } ) ).toThrow( 'Unknown method' )
    } )
} )
