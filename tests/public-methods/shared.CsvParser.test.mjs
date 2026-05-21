import { describe, test, expect } from '@jest/globals'
import { CsvParser } from '../../src/shared/CsvParser.mjs'


const toBuf = ( s ) => Buffer.from( s, 'utf-8' )


describe( 'CsvParser', () => {
    test( 'parses simple CSV with header and rows', () => {
        const buf = toBuf( 'agency_id,agency_name\nDB,Deutsche Bahn\nSWU,SWU Ulm' )
        const { headers, rows, status } = CsvParser.parse( { buffer: buf, filename: 'agency.txt' } )
        expect( status ).toBe( true )
        expect( headers ).toEqual( [ 'agency_id', 'agency_name' ] )
        expect( rows.length ).toBe( 2 )
        expect( rows[ 0 ].agency_id ).toBe( 'DB' )
        expect( rows[ 1 ].agency_name ).toBe( 'SWU Ulm' )
    } )


    test( 'handles quoted fields with commas', () => {
        const buf = toBuf( 'stop_id,stop_name\n1,"Foo, Bar"\n2,Baz' )
        const { rows, status } = CsvParser.parse( { buffer: buf, filename: 'stops.txt' } )
        expect( status ).toBe( true )
        expect( rows[ 0 ].stop_name ).toBe( 'Foo, Bar' )
        expect( rows[ 1 ].stop_name ).toBe( 'Baz' )
    } )


    test( 'handles escaped quotes', () => {
        const buf = toBuf( 'name\n"He said ""hi"""' )
        const { rows } = CsvParser.parse( { buffer: buf, filename: 'x.txt' } )
        expect( rows[ 0 ].name ).toBe( 'He said "hi"' )
    } )


    test( 'handles CRLF line endings', () => {
        const buf = toBuf( 'a,b\r\n1,2\r\n3,4' )
        const { rows } = CsvParser.parse( { buffer: buf, filename: 'x.txt' } )
        expect( rows.length ).toBe( 2 )
        expect( rows[ 0 ] ).toEqual( { a: '1', b: '2' } )
    } )


    test( 'strips BOM', () => {
        const buf = Buffer.concat( [ Buffer.from( [ 0xEF, 0xBB, 0xBF ] ), toBuf( 'a,b\n1,2' ) ] )
        const { headers } = CsvParser.parse( { buffer: buf, filename: 'x.txt' } )
        expect( headers ).toEqual( [ 'a', 'b' ] )
    } )


    test( 'returns GTFS-006 for empty file', () => {
        const buf = toBuf( '' )
        const { status, messages } = CsvParser.parse( { buffer: buf, filename: 'empty.txt' } )
        expect( status ).toBe( false )
        expect( messages[ 0 ].code ).toBe( 'GTFS-006' )
    } )


    test( 'handles trailing newline', () => {
        const buf = toBuf( 'a,b\n1,2\n' )
        const { rows } = CsvParser.parse( { buffer: buf, filename: 'x.txt' } )
        expect( rows.length ).toBe( 1 )
    } )


    test( 'fills missing columns with empty string', () => {
        const buf = toBuf( 'a,b,c\n1,2' )
        const { rows } = CsvParser.parse( { buffer: buf, filename: 'x.txt' } )
        expect( rows[ 0 ].c ).toBe( '' )
    } )
} )
