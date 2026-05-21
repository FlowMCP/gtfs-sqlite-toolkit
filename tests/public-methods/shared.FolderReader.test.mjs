import { describe, test, expect, afterEach } from '@jest/globals'
import { FolderReader } from '../../src/shared/FolderReader.mjs'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'FolderReader', () => {
    test( 'reads .txt and .geojson files', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-folder-' ) )
        writeFileSync( join( tmpDir, 'agency.txt' ), 'agency_id,agency_name\nDB,Deutsche Bahn' )
        writeFileSync( join( tmpDir, 'locations.geojson' ), '{ "type": "FeatureCollection" }' )
        writeFileSync( join( tmpDir, 'readme.md' ), 'should be ignored' )
        const { files } = FolderReader.readFolder( { folderPath: tmpDir } )
        expect( files.size ).toBe( 2 )
        expect( files.has( 'agency.txt' ) ).toBe( true )
        expect( files.has( 'locations.geojson' ) ).toBe( true )
        expect( files.has( 'readme.md' ) ).toBe( false )
    } )


    test( 'throws if path is not a directory', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-folder-' ) )
        const filePath = join( tmpDir, 'not-a-dir.txt' )
        writeFileSync( filePath, 'x' )
        expect( () => FolderReader.readFolder( { folderPath: filePath } ) ).toThrow( 'Not a directory' )
    } )


    test( 'returns empty Map for empty folder', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-folder-' ) )
        const { files } = FolderReader.readFolder( { folderPath: tmpDir } )
        expect( files.size ).toBe( 0 )
    } )


    test( 'hasRelevantFiles returns correct boolean', () => {
        const m1 = new Map()
        const m2 = new Map( [ [ 'a.txt', Buffer.from( 'x' ) ] ] )
        expect( FolderReader.hasRelevantFiles( { files: m1 } ) ).toBe( false )
        expect( FolderReader.hasRelevantFiles( { files: m2 } ) ).toBe( true )
    } )


    test( 'reads file content as Buffer', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-folder-' ) )
        const content = 'agency_id,agency_name\nDB,Deutsche Bahn'
        writeFileSync( join( tmpDir, 'agency.txt' ), content )
        const { files } = FolderReader.readFolder( { folderPath: tmpDir } )
        const buf = files.get( 'agency.txt' )
        expect( Buffer.isBuffer( buf ) ).toBe( true )
        expect( buf.toString( 'utf-8' ) ).toBe( content )
    } )
} )
