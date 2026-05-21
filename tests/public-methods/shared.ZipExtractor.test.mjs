import { describe, test, expect, afterEach } from '@jest/globals'
import { ZipExtractor } from '../../src/shared/ZipExtractor.mjs'
import { buildZipBuffer } from '../helpers/zip-builder.mjs'
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


describe( 'ZipExtractor', () => {
    test( 'extractZipBufferToFiles extracts multiple files', async () => {
        const buf = await buildZipBuffer( { entries: [
            [ 'agency.txt', 'agency_id,agency_name\nDB,Deutsche Bahn' ],
            [ 'stops.txt',  'stop_id,stop_name\n1,Hauptbahnhof' ]
        ] } )
        const { files } = await ZipExtractor.extractZipBufferToFiles( { buffer: buf } )
        expect( files.size ).toBe( 2 )
        expect( files.has( 'agency.txt' ) ).toBe( true )
        expect( files.has( 'stops.txt' ) ).toBe( true )
        expect( files.get( 'agency.txt' ).toString( 'utf-8' ) ).toContain( 'Deutsche Bahn' )
    } )


    test( 'extractZipToBuffer extracts from file path', async () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-zip-' ) )
        const zipPath = join( tmpDir, 'test.zip' )
        const buf = await buildZipBuffer( { entries: [
            [ 'agency.txt', 'agency_id,agency_name\nDB,Deutsche Bahn' ]
        ] } )
        writeFileSync( zipPath, buf )
        const { files } = await ZipExtractor.extractZipToBuffer( { zipPath } )
        expect( files.size ).toBe( 1 )
        expect( files.get( 'agency.txt' ).toString( 'utf-8' ) ).toContain( 'DB' )
    } )


    test( 'extractZipBufferToFiles handles nested paths by basename', async () => {
        const buf = await buildZipBuffer( { entries: [
            [ 'subdir/agency.txt', 'agency_id\nDB' ]
        ] } )
        const { files } = await ZipExtractor.extractZipBufferToFiles( { buffer: buf } )
        expect( files.has( 'agency.txt' ) ).toBe( true )
    } )


    test( 'detectEncoding identifies UTF-8 without BOM', () => {
        const buf = Buffer.from( 'agency_id,agency_name\nDB,Deutsche Bahn', 'utf-8' )
        const { encoding, hasBom } = ZipExtractor.detectEncoding( { buffer: buf } )
        expect( encoding ).toBe( 'utf-8' )
        expect( hasBom ).toBe( false )
    } )


    test( 'detectEncoding identifies UTF-8 with BOM', () => {
        const buf = Buffer.concat( [
            Buffer.from( [ 0xEF, 0xBB, 0xBF ] ),
            Buffer.from( 'a,b\n1,2', 'utf-8' )
        ] )
        const { encoding, hasBom } = ZipExtractor.detectEncoding( { buffer: buf } )
        expect( encoding ).toBe( 'utf-8' )
        expect( hasBom ).toBe( true )
    } )


    test( 'detectEncoding identifies non-UTF-8', () => {
        const buf = Buffer.from( [ 0x41, 0xE4, 0x42 ] )
        const { encoding } = ZipExtractor.detectEncoding( { buffer: buf } )
        expect( encoding ).toBe( 'non-utf-8' )
    } )


    test( 'extractZipToBuffer rejects on missing file', async () => {
        await expect( ZipExtractor.extractZipToBuffer( { zipPath: '/nonexistent.zip' } ) ).rejects.toThrow()
    } )
} )
