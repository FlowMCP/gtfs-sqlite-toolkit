import { describe, test, expect, afterEach } from '@jest/globals'
import { GtfsSqliteConverter } from '../../src/GtfsSqliteConverter.mjs'
import { ScheduleMetadataSchema } from '../../src/converters/schedule/ScheduleMetadataSchema.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import {
    buildMinimalValidZip,
    buildBrokenFkZip,
    buildMissingRequiredZip,
    buildFlexZip
} from '../helpers/build-minimal-zip.mjs'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


const setupTmpDir = () => {
    tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-pipeline-' ) )
    return tmpDir
}


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'GtfsSqliteConverter (Pipeline)', () => {
    test( 'returns error for unsupported gtfsSpec', async () => {
        const result = await GtfsSqliteConverter.start( {
            input: Buffer.from( 'x' ),
            inputType: 'buffer',
            dbPath: '/tmp/dummy.db',
            gtfsSpec: 'realtime'
        } )
        expect( result.status ).toBe( false )
        expect( result.messages[ 0 ].code ).toBe( 'GTFS-007' )
    } )


    test( 'minimal valid ZIP produces sealed DB', async () => {
        setupTmpDir()
        const buf = await buildMinimalValidZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'buffer',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.aborted ).toBe( false )
        expect( result.seal ).toBe( 'sqlite-gtfs' )
        expect( existsSync( dbPath ) ).toBe( true )
        expect( result.report.errors.length ).toBe( 0 )

        const meta = ScheduleMetadataSchema.parseMeta( { dbPath } )
        expect( meta.qualitySeal ).toBe( 'sqlite-gtfs' )
        expect( meta.specRevision ).toBe( '2026-04-27' )
    } )


    test( 'broken FK aborts in default mode', async () => {
        setupTmpDir()
        const buf = await buildBrokenFkZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'buffer',
            dbPath
        } )
        expect( result.status ).toBe( false )
        expect( result.aborted ).toBe( true )
        expect( result.seal ).toBeNull()
        expect( existsSync( dbPath ) ).toBe( false )
        const fkErrors = result.report.errors.filter( ( e ) => e.code === 'GTFS-003' )
        expect( fkErrors.length ).toBeGreaterThan( 0 )
    } )


    test( 'broken FK with force=true produces DB without seal', async () => {
        setupTmpDir()
        const buf = await buildBrokenFkZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'buffer',
            dbPath,
            force: true
        } )
        expect( result.status ).toBe( true )
        expect( result.aborted ).toBe( false )
        expect( result.seal ).toBeNull()
        expect( existsSync( dbPath ) ).toBe( true )
        const meta = ScheduleMetadataSchema.parseMeta( { dbPath } )
        expect( meta.qualitySeal ).toBeNull()
    } )


    test( 'missing required file aborts without force', async () => {
        setupTmpDir()
        const buf = await buildMissingRequiredZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'buffer',
            dbPath
        } )
        expect( result.aborted ).toBe( true )
        const fileErrors = result.report.errors.filter( ( e ) => e.code === 'GTFS-001' )
        expect( fileErrors.length ).toBeGreaterThan( 0 )
    } )


    test( 'auto-detect identifies ZIP buffer', async () => {
        setupTmpDir()
        const buf = await buildMinimalValidZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'auto',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-gtfs' )
    } )


    test( 'zip from file path produces DB', async () => {
        setupTmpDir()
        const buf = await buildMinimalValidZip()
        const zipPath = join( tmpDir, 'test.zip' )
        writeFileSync( zipPath, buf )
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: zipPath,
            inputType: 'zip',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-gtfs' )
    } )


    test( 'capabilities reflect flex zip', async () => {
        setupTmpDir()
        const buf = await buildFlexZip()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: buf,
            inputType: 'buffer',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.capabilities.flexService ).toBe( true )
    } )


    test( 'folder input produces DB', async () => {
        setupTmpDir()
        const folder = join( tmpDir, 'feed' )
        rmSync( folder, { recursive: true, force: true } )
        const { mkdirSync, writeFileSync: wf } = await import( 'node:fs' )
        mkdirSync( folder )
        wf( join( folder, 'agency.txt' ), 'agency_id,agency_name,agency_url,agency_timezone\nDB,Deutsche Bahn,https://bahn.de,Europe/Berlin' )
        wf( join( folder, 'stops.txt' ), 'stop_id,stop_name,stop_lat,stop_lon\nS1,Hauptbahnhof,48.4,9.99' )
        wf( join( folder, 'routes.txt' ), 'route_id,agency_id,route_short_name,route_long_name,route_type\nR1,DB,ICE,Hamburg-Ulm,2' )
        wf( join( folder, 'trips.txt' ), 'trip_id,route_id,service_id\nT1,R1,WORKDAY' )
        wf( join( folder, 'stop_times.txt' ), 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,S1,1' )
        wf( join( folder, 'calendar.txt' ), 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWORKDAY,1,1,1,1,1,0,0,20260101,20261231' )

        const dbPath = join( tmpDir, 'out.db' )
        const result = await GtfsSqliteConverter.start( {
            input: folder,
            inputType: 'folder',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-gtfs' )
    } )


    test( 'DB has agency rows after conversion', async () => {
        setupTmpDir()
        const buf = await buildMinimalValidZip()
        const dbPath = join( tmpDir, 'out.db' )
        await GtfsSqliteConverter.start( { input: buf, inputType: 'buffer', dbPath } )
        const { db } = SqliteBuilder.openDatabase( { dbPath } )
        const count = db.prepare( 'SELECT COUNT(*) AS n FROM agency' ).get()
        expect( count.n ).toBe( 1 )
        const stops = db.prepare( 'SELECT COUNT(*) AS n FROM stops' ).get()
        expect( stops.n ).toBe( 2 )
        SqliteBuilder.close( { db } )
    } )
} )
