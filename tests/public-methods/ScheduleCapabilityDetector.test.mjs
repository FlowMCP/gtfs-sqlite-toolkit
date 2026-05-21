import { describe, test, expect } from '@jest/globals'
import { ScheduleCapabilityDetector } from '../../src/converters/schedule/ScheduleCapabilityDetector.mjs'


const makeParsed = ( headers, rows = [] ) => ( { headers, rows, status: true, messages: [] } )


describe( 'ScheduleCapabilityDetector', () => {
    test( 'all false for empty input', () => {
        const caps = ScheduleCapabilityDetector.detect( { parsedFiles: new Map() } )
        Object.values( caps ).forEach( ( v ) => expect( v ).toBe( false ) )
    } )


    test( 'basicLookup true with agency+stops+routes', () => {
        const files = new Map( [
            [ 'agency.txt', makeParsed( [ 'agency_id' ] ) ],
            [ 'stops.txt',  makeParsed( [ 'stop_id' ] ) ],
            [ 'routes.txt', makeParsed( [ 'route_id' ] ) ]
        ] )
        const caps = ScheduleCapabilityDetector.detect( { parsedFiles: files } )
        expect( caps.basicLookup ).toBe( true )
        expect( caps.routing ).toBe( false )
    } )


    test( 'routing true with trips+stop_times', () => {
        const files = new Map( [
            [ 'trips.txt',      makeParsed( [ 'trip_id' ] ) ],
            [ 'stop_times.txt', makeParsed( [ 'trip_id' ] ) ]
        ] )
        const caps = ScheduleCapabilityDetector.detect( { parsedFiles: files } )
        expect( caps.routing ).toBe( true )
    } )


    test( 'departures requires stop_times + calendar/calendar_dates', () => {
        const files1 = new Map( [
            [ 'stop_times.txt', makeParsed( [ 'trip_id' ] ) ],
            [ 'calendar.txt',   makeParsed( [ 'service_id' ] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files1 } ).departures ).toBe( true )

        const files2 = new Map( [
            [ 'stop_times.txt',   makeParsed( [ 'trip_id' ] ) ],
            [ 'calendar_dates.txt', makeParsed( [ 'service_id' ] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files2 } ).departures ).toBe( true )

        const files3 = new Map( [
            [ 'stop_times.txt', makeParsed( [ 'trip_id' ] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files3 } ).departures ).toBe( false )
    } )


    test( 'flexService true with booking_rules or locations.geojson', () => {
        const files = new Map( [
            [ 'booking_rules.txt', makeParsed( [ 'booking_rule_id' ] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).flexService ).toBe( true )

        const files2 = new Map( [
            [ 'locations.geojson', makeParsed( [], [] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files2 } ).flexService ).toBe( true )
    } )


    test( 'shapesVisualization true with shapes.txt', () => {
        const files = new Map( [ [ 'shapes.txt', makeParsed( [ 'shape_id' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).shapesVisualization ).toBe( true )
    } )


    test( 'stationNavigation requires pathways AND levels', () => {
        const files1 = new Map( [ [ 'pathways.txt', makeParsed( [ 'pathway_id' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files1 } ).stationNavigation ).toBe( false )
        const files2 = new Map( [
            [ 'pathways.txt', makeParsed( [ 'pathway_id' ] ) ],
            [ 'levels.txt',   makeParsed( [ 'level_id' ] ) ]
        ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files2 } ).stationNavigation ).toBe( true )
    } )


    test( 'multilingual true with translations.txt', () => {
        const files = new Map( [ [ 'translations.txt', makeParsed( [ 'table_name' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).multilingual ).toBe( true )
    } )


    test( 'frequencyBased true with frequencies.txt', () => {
        const files = new Map( [ [ 'frequencies.txt', makeParsed( [ 'trip_id' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).frequencyBased ).toBe( true )
    } )


    test( 'fareCalculationV2 true with fare_leg_rules', () => {
        const files = new Map( [ [ 'fare_leg_rules.txt', makeParsed( [ 'fare_product_id' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).fareCalculationV2 ).toBe( true )
    } )


    test( 'fareTransfers true with fare_transfer_rules', () => {
        const files = new Map( [ [ 'fare_transfer_rules.txt', makeParsed( [ 'from_leg_group_id' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).fareTransfers ).toBe( true )
    } )


    test( 'licensedAttribution requires non-empty attributions', () => {
        const files1 = new Map( [ [ 'attributions.txt', makeParsed( [ 'organization_name' ], [] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files1 } ).licensedAttribution ).toBe( false )
        const files2 = new Map( [ [ 'attributions.txt', makeParsed( [ 'organization_name' ], [ { organization_name: 'DB' } ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files2 } ).licensedAttribution ).toBe( true )
    } )


    test( 'continuousBoarding true with routes.continuous_pickup field', () => {
        const files = new Map( [ [ 'routes.txt', makeParsed( [ 'route_id', 'continuous_pickup' ] ) ] ] )
        expect( ScheduleCapabilityDetector.detect( { parsedFiles: files } ).continuousBoarding ).toBe( true )
    } )
} )
