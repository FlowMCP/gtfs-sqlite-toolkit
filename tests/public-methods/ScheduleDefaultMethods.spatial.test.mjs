import { describe, test, expect, afterEach } from '@jest/globals'
import { ScheduleDefaultMethods } from '../../src/converters/schedule/ScheduleDefaultMethods.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


const buildStopsDb = ( { rows } ) => {
    tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-spatial-' ) )
    const dbPath = join( tmpDir, 'stops.db' )
    const schema = {
        stops: [
            { name: 'stop_id',   type: 'TEXT PRIMARY KEY' },
            { name: 'stop_name', type: 'TEXT' },
            { name: 'stop_lat',  type: 'REAL' },
            { name: 'stop_lon',  type: 'REAL' }
        ]
    }
    const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
    SqliteBuilder.insertRows( { db, tableName: 'stops', rows } )
    return { db }
}


// Reference Haversine (mirror of GeojsonDefaultMethods.#haversineKm * 1000)
const referenceHaversineM = ( { lat1, lon1, lat2, lon2 } ) => {
    const toRad = ( deg ) => deg * Math.PI / 180
    const R = 6371
    const dLat = toRad( lat2 - lat1 )
    const dLon = toRad( lon2 - lon1 )
    const a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
        Math.cos( toRad( lat1 ) ) * Math.cos( toRad( lat2 ) ) *
        Math.sin( dLon / 2 ) * Math.sin( dLon / 2 )
    const c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) )
    return R * c * 1000
}


const BERLIN_HBF = { lat: 52.525589, lon: 13.369548 }


// Fixture stops around Berlin Hbf, plus a far-away stop (Munich) for radius filtering.
const FIXTURE_ROWS = [
    { stop_id: 'hbf',  stop_name: 'Berlin Hbf',          stop_lat: 52.525589, stop_lon: 13.369548 },
    { stop_id: 'east', stop_name: '100m east',           stop_lat: 52.525589, stop_lon: 13.370548 },
    { stop_id: 'fri',  stop_name: 'Friedrichstrasse',    stop_lat: 52.520008, stop_lon: 13.387091 },
    { stop_id: 'far',  stop_name: 'Munich Hbf',          stop_lat: 48.140232, stop_lon: 11.558335 },
    { stop_id: 'null', stop_name: 'No coordinates',      stop_lat: null,      stop_lon: null }
]


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'ScheduleDefaultMethods spatial — nearPoint', () => {
    test( 'returns nearest-first with distanceM, respects radius', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )

        const ids = stops.map( ( s ) => s.stop_id )
        expect( ids ).toEqual( [ 'hbf', 'east', 'fri' ] )
        expect( stops[ 0 ].distanceM ).toBe( 0 )
        // ascending order
        expect( stops[ 0 ].distanceM ).toBeLessThanOrEqual( stops[ 1 ].distanceM )
        expect( stops[ 1 ].distanceM ).toBeLessThanOrEqual( stops[ 2 ].distanceM )
        // Munich (far) and the null-coordinate stop are excluded
        expect( ids ).not.toContain( 'far' )
        expect( ids ).not.toContain( 'null' )
    } )


    test( 'distanceM matches GeoJSON reference Haversine within < 1m', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )

        const fri = stops.find( ( s ) => s.stop_id === 'fri' )
        const expected = referenceHaversineM( {
            lat1: BERLIN_HBF.lat, lon1: BERLIN_HBF.lon, lat2: 52.520008, lon2: 13.387091
        } )
        expect( Math.abs( fri.distanceM - expected ) ).toBeLessThan( 1 )
    } )


    test( 'small radius returns fewer stops than large radius', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const small = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 200
        } )
        const large = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )
        expect( small.stops.length ).toBeLessThan( large.stops.length )
        expect( small.stops.map( ( s ) => s.stop_id ) ).toEqual( [ 'hbf', 'east' ] )
    } )


    test( 'respects limit', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000, limit: 1
        } )
        SqliteBuilder.close( { db } )
        expect( stops.length ).toBe( 1 )
        expect( stops[ 0 ].stop_id ).toBe( 'hbf' )
    } )


    test( 'output rows contain the expected fields', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 200, limit: 1
        } )
        SqliteBuilder.close( { db } )
        expect( Object.keys( stops[ 0 ] ).sort() ).toEqual(
            [ 'distanceM', 'stop_id', 'stop_lat', 'stop_lon', 'stop_name' ]
        )
    } )


    test( 'throws on missing lat', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        expect( () => ScheduleDefaultMethods.nearPoint( {
            db, lon: BERLIN_HBF.lon, radiusMeters: 200
        } ) ).toThrow( 'lat is required' )
        SqliteBuilder.close( { db } )
    } )


    test( 'throws on missing radiusMeters', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        expect( () => ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon
        } ) ).toThrow( 'radiusMeters is required' )
        SqliteBuilder.close( { db } )
    } )


    test( 'throws on missing db', () => {
        expect( () => ScheduleDefaultMethods.nearPoint( {
            lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 200
        } ) ).toThrow( 'db is required' )
    } )
} )


describe( 'ScheduleDefaultMethods spatial — inBoundingBox', () => {
    test( 'returns only stops inside the box (lon-first)', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53
        } )
        SqliteBuilder.close( { db } )
        const ids = stops.map( ( s ) => s.stop_id ).sort()
        expect( ids ).toEqual( [ 'east', 'fri', 'hbf' ] )
        // Munich is far outside
        expect( ids ).not.toContain( 'far' )
        // null coordinates are excluded
        expect( ids ).not.toContain( 'null' )
    } )


    test( 'boundary case — stop just outside the box is excluded', () => {
        // Box tightly around Berlin Hbf only; 'fri' (lon 13.387) is just outside maxLon
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369, minLat: 52.525, maxLon: 13.371, maxLat: 52.526
        } )
        SqliteBuilder.close( { db } )
        const ids = stops.map( ( s ) => s.stop_id ).sort()
        expect( ids ).toEqual( [ 'east', 'hbf' ] )
        expect( ids ).not.toContain( 'fri' )
    } )


    test( 'boundary inclusive — stop exactly on the edge is included', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        // maxLon set exactly to the 'east' stop longitude
        const { stops } = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369548, minLat: 52.525589, maxLon: 13.370548, maxLat: 52.525589
        } )
        SqliteBuilder.close( { db } )
        const ids = stops.map( ( s ) => s.stop_id ).sort()
        expect( ids ).toEqual( [ 'east', 'hbf' ] )
    } )


    test( 'respects limit', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53, limit: 2
        } )
        SqliteBuilder.close( { db } )
        expect( stops.length ).toBe( 2 )
    } )


    test( 'output rows contain the expected fields', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const { stops } = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369, minLat: 52.525, maxLon: 13.371, maxLat: 52.526
        } )
        SqliteBuilder.close( { db } )
        expect( Object.keys( stops[ 0 ] ).sort() ).toEqual(
            [ 'stop_id', 'stop_lat', 'stop_lon', 'stop_name' ]
        )
    } )


    test( 'throws on missing maxLon', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        expect( () => ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLat: 52.53
        } ) ).toThrow( 'maxLon is required' )
        SqliteBuilder.close( { db } )
    } )


    test( 'throws on missing db', () => {
        expect( () => ScheduleDefaultMethods.inBoundingBox( {
            minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53
        } ) ).toThrow( 'db is required' )
    } )
} )
