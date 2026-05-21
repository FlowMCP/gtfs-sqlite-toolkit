import { describe, test, expect, afterEach } from '@jest/globals'
import { InputDetector } from '../../src/shared/InputDetector.mjs'
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


describe( 'InputDetector', () => {
    test( 'detects ZIP from buffer magic bytes', () => {
        const buf = Buffer.from( [ 0x50, 0x4B, 0x03, 0x04, 0x00, 0x00 ] )
        const { inputType } = InputDetector.detect( { input: buf } )
        expect( inputType ).toBe( 'buffer' )
    } )


    test( 'detects gzip/tar.gz from buffer magic bytes', () => {
        const buf = Buffer.from( [ 0x1F, 0x8B, 0x08, 0x00 ] )
        const { inputType } = InputDetector.detect( { input: buf } )
        expect( inputType ).toBe( 'targz-buffer' )
    } )


    test( 'throws on unknown buffer magic', () => {
        const buf = Buffer.from( [ 0x00, 0x00, 0x00 ] )
        expect( () => InputDetector.detect( { input: buf } ) ).toThrow( 'Unknown buffer' )
    } )


    test( 'detects zip from path extension', () => {
        const { inputType } = InputDetector.detect( { input: '/path/to/feed.zip' } )
        expect( inputType ).toBe( 'zip' )
    } )


    test( 'detects targz from .tar.gz extension', () => {
        const { inputType } = InputDetector.detect( { input: '/path/to/feed.tar.gz' } )
        expect( inputType ).toBe( 'targz' )
    } )


    test( 'detects targz from .tgz extension', () => {
        const { inputType } = InputDetector.detect( { input: '/path/to/feed.tgz' } )
        expect( inputType ).toBe( 'targz' )
    } )


    test( 'detects folder from existing directory', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'gtfs-id-' ) )
        const { inputType } = InputDetector.detect( { input: tmpDir } )
        expect( inputType ).toBe( 'folder' )
    } )


    test( 'throws for .pb (Realtime) extension', () => {
        expect( () => InputDetector.detect( { input: '/path/to/feed.pb' } ) ).toThrow( 'GTFS-Realtime' )
    } )


    test( 'throws for unknown path with no matching extension', () => {
        expect( () => InputDetector.detect( { input: '/path/to/feed.xml' } ) ).toThrow( 'Cannot detect' )
    } )


    test( 'throws for non-buffer non-string input', () => {
        expect( () => InputDetector.detect( { input: 42 } ) ).toThrow( 'Buffer or string' )
    } )
} )
