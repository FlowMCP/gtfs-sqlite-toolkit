import { describe, test, expect } from '@jest/globals'
import { ScheduleForeignKeyChecker } from '../../src/converters/schedule/ScheduleForeignKeyChecker.mjs'


const makeParsed = ( headers, rows ) => ( { headers, rows, status: true, messages: [] } )


describe( 'ScheduleForeignKeyChecker', () => {
    test( 'detects broken FK from trips.route_id to routes.route_id', () => {
        const parsedFiles = new Map( [
            [ 'routes.txt', makeParsed( [ 'route_id' ], [
                { route_id: 'R-1' },
                { route_id: 'R-2' }
            ] ) ],
            [ 'trips.txt', makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [
                { trip_id: 'T-1', route_id: 'R-1', service_id: 'S-1' },
                { trip_id: 'T-2', route_id: 'R-42', service_id: 'S-1' }
            ] ) ]
        ] )
        const v = ScheduleForeignKeyChecker.check( { parsedFiles } )
        const report = v.report()
        const fkErrors = report.errors.filter( ( e ) => e.code === 'GTFS-003' )
        expect( fkErrors.length ).toBeGreaterThan( 0 )
        const tripsErrors = fkErrors.filter( ( e ) => e.file === 'trips.txt' )
        expect( tripsErrors.some( ( e ) => e.message.includes( 'R-42' ) ) ).toBe( true )
    } )


    test( 'passes when all FKs resolve', () => {
        const parsedFiles = new Map( [
            [ 'routes.txt', makeParsed( [ 'route_id' ], [ { route_id: 'R-1' } ] ) ],
            [ 'trips.txt',  makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [
                { trip_id: 'T-1', route_id: 'R-1', service_id: 'S-1' }
            ] ) ]
        ] )
        const v = ScheduleForeignKeyChecker.check( { parsedFiles } )
        const report = v.report()
        const fkErrors = report.errors.filter( ( e ) => e.code === 'GTFS-003' && e.file === 'trips.txt' )
        expect( fkErrors.length ).toBe( 0 )
    } )


    test( 'ignores empty FK values', () => {
        const parsedFiles = new Map( [
            [ 'routes.txt', makeParsed( [ 'route_id' ], [ { route_id: 'R-1' } ] ) ],
            [ 'trips.txt',  makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [
                { trip_id: 'T-1', route_id: '', service_id: 'S-1' }
            ] ) ]
        ] )
        const v = ScheduleForeignKeyChecker.check( { parsedFiles } )
        const report = v.report()
        const onTrips = report.errors.filter( ( e ) => e.file === 'trips.txt' && e.message.includes( 'route_id' ) )
        expect( onTrips.length ).toBe( 0 )
    } )


    test( 'returns empty report for empty input', () => {
        const v = ScheduleForeignKeyChecker.check( { parsedFiles: new Map() } )
        const report = v.report()
        expect( report.status ).toBe( true )
        expect( report.errors.length ).toBe( 0 )
    } )


    test( 'error message includes row index for debugging', () => {
        const parsedFiles = new Map( [
            [ 'routes.txt', makeParsed( [ 'route_id' ], [ { route_id: 'R-1' } ] ) ],
            [ 'trips.txt',  makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [
                { trip_id: 'T-1', route_id: 'R-1', service_id: 'S-1' },
                { trip_id: 'T-2', route_id: 'R-1', service_id: 'S-1' },
                { trip_id: 'T-3', route_id: 'BROKEN', service_id: 'S-1' }
            ] ) ]
        ] )
        const v = ScheduleForeignKeyChecker.check( { parsedFiles } )
        const report = v.report()
        const fkErrors = report.errors.filter( ( e ) => e.message.includes( 'BROKEN' ) )
        expect( fkErrors.length ).toBe( 1 )
        expect( fkErrors[ 0 ].message ).toContain( 'row 4' )
    } )
} )
