import { describe, test, expect } from '@jest/globals'
import { ScheduleSpecValidator } from '../../src/converters/schedule/ScheduleSpecValidator.mjs'


const makeParsed = ( headers, rows ) => ( { headers, rows, status: true, messages: [] } )


describe( 'ScheduleSpecValidator', () => {
    test( 'getSpec returns spec-reference with 32 files', () => {
        const spec = ScheduleSpecValidator.getSpec()
        expect( spec.specRevision ).toBe( '2026-04-27' )
        expect( spec.specUrl ).toContain( 'gtfs.org' )
        expect( Object.keys( spec.files ).length ).toBe( 32 )
    } )


    test( 'identifies missing required files (GTFS-001)', () => {
        const parsedFiles = new Map( [
            [ 'agency.txt', makeParsed( [ 'agency_id', 'agency_name', 'agency_url', 'agency_timezone' ], [] ) ]
            // missing routes.txt, trips.txt, stop_times.txt
        ] )
        const v = ScheduleSpecValidator.validate( { parsedFiles } )
        const report = v.report()
        const missingFileErrors = report.errors.filter( ( e ) => e.code === 'GTFS-001' )
        expect( missingFileErrors.length ).toBeGreaterThanOrEqual( 3 )
        const missingFiles = missingFileErrors.map( ( e ) => e.file )
        expect( missingFiles ).toContain( 'routes.txt' )
        expect( missingFiles ).toContain( 'trips.txt' )
        expect( missingFiles ).toContain( 'stop_times.txt' )
    } )


    test( 'identifies missing required fields (GTFS-002)', () => {
        const parsedFiles = new Map( [
            [ 'agency.txt', makeParsed( [ 'agency_id' ], [] ) ],
            [ 'routes.txt', makeParsed( [ 'route_id', 'agency_id', 'route_type' ], [] ) ],
            [ 'trips.txt', makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [] ) ],
            [ 'stop_times.txt', makeParsed( [ 'trip_id', 'stop_sequence' ], [] ) ]
        ] )
        const v = ScheduleSpecValidator.validate( { parsedFiles } )
        const report = v.report()
        const missingFieldErrors = report.errors.filter( ( e ) => e.code === 'GTFS-002' )
        expect( missingFieldErrors.length ).toBeGreaterThan( 0 )
        const onAgency = missingFieldErrors.filter( ( e ) => e.file === 'agency.txt' )
        expect( onAgency.some( ( e ) => e.message.includes( 'agency_name' ) ) ).toBe( true )
    } )


    test( 'passes when all required files and fields present', () => {
        const parsedFiles = new Map( [
            [ 'agency.txt',     makeParsed( [ 'agency_id', 'agency_name', 'agency_url', 'agency_timezone' ], [] ) ],
            [ 'routes.txt',     makeParsed( [ 'route_id', 'route_type' ], [] ) ],
            [ 'trips.txt',      makeParsed( [ 'trip_id', 'route_id', 'service_id' ], [] ) ],
            [ 'stop_times.txt', makeParsed( [ 'trip_id', 'stop_sequence' ], [] ) ]
        ] )
        const v = ScheduleSpecValidator.validate( { parsedFiles } )
        const report = v.report()
        const fileErrors = report.errors.filter( ( e ) => e.code === 'GTFS-001' )
        expect( fileErrors.length ).toBe( 0 )
    } )


    test( 'ignores unknown files in spec', () => {
        const parsedFiles = new Map( [
            [ 'unknown_custom.txt', makeParsed( [ 'foo' ], [ { foo: 'bar' } ] ) ]
        ] )
        const v = ScheduleSpecValidator.validate( { parsedFiles } )
        const report = v.report()
        const unknownErrors = report.errors.filter( ( e ) => e.file === 'unknown_custom.txt' )
        expect( unknownErrors.length ).toBe( 0 )
    } )
} )
