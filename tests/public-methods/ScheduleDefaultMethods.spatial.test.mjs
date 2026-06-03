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


// Helpers to read the FeatureCollection (RFC 7946) output shape.
const idsOf = ( fc ) => fc.features.map( ( f ) => f.properties.stop_id )
const featureById = ( fc, id ) => fc.features.find( ( f ) => f.properties.stop_id === id )


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'ScheduleDefaultMethods spatial — nearPoint', () => {
    test( 'returns a FeatureCollection nearest-first with _distanceMeters, respects radius', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )

        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.meta ).toEqual( { count: 3, source: 'gtfs-de' } )
        expect( fc.meta.count ).toBe( fc.features.length )

        const ids = idsOf( fc )
        expect( ids ).toEqual( [ 'hbf', 'east', 'fri' ] )
        expect( fc.features[ 0 ].properties._distanceMeters ).toBe( 0 )
        // ascending order
        expect( fc.features[ 0 ].properties._distanceMeters )
            .toBeLessThanOrEqual( fc.features[ 1 ].properties._distanceMeters )
        expect( fc.features[ 1 ].properties._distanceMeters )
            .toBeLessThanOrEqual( fc.features[ 2 ].properties._distanceMeters )
        // Munich (far) and the null-coordinate stop are excluded
        expect( ids ).not.toContain( 'far' )
        expect( ids ).not.toContain( 'null' )
    } )


    test( 'each feature is RFC 7946 with lon-first coordinates', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )

        const east = featureById( fc, 'east' )
        expect( east.type ).toBe( 'Feature' )
        expect( east.geometry.type ).toBe( 'Point' )
        expect( east.geometry.coordinates ).toEqual( [ 13.370548, 52.525589 ] )
        expect( east.properties._source ).toBe( 'gtfs-de' )
    } )


    test( '_distanceMeters matches GeoJSON reference Haversine within < 1m', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000
        } )
        SqliteBuilder.close( { db } )

        const fri = featureById( fc, 'fri' )
        const expected = referenceHaversineM( {
            lat1: BERLIN_HBF.lat, lon1: BERLIN_HBF.lon, lat2: 52.520008, lon2: 13.387091
        } )
        expect( Math.abs( fri.properties._distanceMeters - expected ) ).toBeLessThan( 1 )
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
        expect( small.features.length ).toBeLessThan( large.features.length )
        expect( idsOf( small ) ).toEqual( [ 'hbf', 'east' ] )
    } )


    test( 'respects limit', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 2000, limit: 1
        } )
        SqliteBuilder.close( { db } )
        expect( fc.features.length ).toBe( 1 )
        expect( fc.meta.count ).toBe( 1 )
        expect( fc.features[ 0 ].properties.stop_id ).toBe( 'hbf' )
    } )


    test( 'feature properties contain the expected fields', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.nearPoint( {
            db, lat: BERLIN_HBF.lat, lon: BERLIN_HBF.lon, radiusMeters: 200, limit: 1
        } )
        SqliteBuilder.close( { db } )
        expect( Object.keys( fc.features[ 0 ].properties ).sort() ).toEqual(
            [ '_distanceMeters', '_source', 'stop_id', 'stop_name' ]
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
    test( 'returns a FeatureCollection of stops inside the box (lon-first)', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53
        } )
        SqliteBuilder.close( { db } )

        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.meta ).toEqual( { count: 3, source: 'gtfs-de' } )
        expect( fc.meta.count ).toBe( fc.features.length )

        const ids = idsOf( fc ).sort()
        expect( ids ).toEqual( [ 'east', 'fri', 'hbf' ] )
        // Munich is far outside
        expect( ids ).not.toContain( 'far' )
        // null coordinates are excluded
        expect( ids ).not.toContain( 'null' )
    } )


    test( '_distanceMeters is null for bbox results', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53
        } )
        SqliteBuilder.close( { db } )
        fc.features.forEach( ( f ) => {
            expect( f.properties._distanceMeters ).toBeNull()
            expect( f.properties._source ).toBe( 'gtfs-de' )
        } )
    } )


    test( 'each feature is RFC 7946 with lon-first coordinates', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369, minLat: 52.525, maxLon: 13.371, maxLat: 52.526
        } )
        SqliteBuilder.close( { db } )
        const east = featureById( fc, 'east' )
        expect( east.type ).toBe( 'Feature' )
        expect( east.geometry.type ).toBe( 'Point' )
        expect( east.geometry.coordinates ).toEqual( [ 13.370548, 52.525589 ] )
    } )


    test( 'boundary case — stop just outside the box is excluded', () => {
        // Box tightly around Berlin Hbf only; 'fri' (lon 13.387) is just outside maxLon
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369, minLat: 52.525, maxLon: 13.371, maxLat: 52.526
        } )
        SqliteBuilder.close( { db } )
        const ids = idsOf( fc ).sort()
        expect( ids ).toEqual( [ 'east', 'hbf' ] )
        expect( ids ).not.toContain( 'fri' )
    } )


    test( 'boundary inclusive — stop exactly on the edge is included', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        // maxLon set exactly to the 'east' stop longitude
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369548, minLat: 52.525589, maxLon: 13.370548, maxLat: 52.525589
        } )
        SqliteBuilder.close( { db } )
        const ids = idsOf( fc ).sort()
        expect( ids ).toEqual( [ 'east', 'hbf' ] )
    } )


    test( 'respects limit', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.36, minLat: 52.51, maxLon: 13.39, maxLat: 52.53, limit: 2
        } )
        SqliteBuilder.close( { db } )
        expect( fc.features.length ).toBe( 2 )
        expect( fc.meta.count ).toBe( 2 )
    } )


    test( 'feature properties contain the expected fields', () => {
        const { db } = buildStopsDb( { rows: FIXTURE_ROWS } )
        const fc = ScheduleDefaultMethods.inBoundingBox( {
            db, minLon: 13.369, minLat: 52.525, maxLon: 13.371, maxLat: 52.526
        } )
        SqliteBuilder.close( { db } )
        expect( Object.keys( fc.features[ 0 ].properties ).sort() ).toEqual(
            [ '_distanceMeters', '_source', 'stop_id', 'stop_name' ]
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
