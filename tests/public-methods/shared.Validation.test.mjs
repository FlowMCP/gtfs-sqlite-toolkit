import { describe, test, expect } from '@jest/globals'
import { Validation } from '../../src/shared/Validation.mjs'


describe( 'Validation', () => {
    test( 'create returns instance', () => {
        const v = Validation.create()
        expect( v ).toBeInstanceOf( Validation )
    } )


    test( 'getCodes returns all 21 codes', () => {
        const codes = Validation.getCodes()
        const keys = Object.keys( codes )
        expect( keys.length ).toBe( 21 )
        const errors = keys.filter( ( k ) => codes[ k ].severity === 'ERROR' )
        const warnings = keys.filter( ( k ) => codes[ k ].severity === 'WARNING' )
        const infos = keys.filter( ( k ) => codes[ k ].severity === 'INFO' )
        expect( errors.length ).toBe( 8 )
        expect( warnings.length ).toBe( 7 )
        expect( infos.length ).toBe( 6 )
    } )


    test( 'getCodeMeta returns code metadata', () => {
        const meta = Validation.getCodeMeta( { code: 'GTFS-003' } )
        expect( meta.severity ).toBe( 'ERROR' )
        expect( meta.description ).toContain( 'Foreign key' )
    } )


    test( 'getCodeMeta throws on unknown code', () => {
        expect( () => Validation.getCodeMeta( { code: 'GTFS-999' } ) ).toThrow( 'Unknown GTFS code' )
    } )


    test( 'error adds error entry', () => {
        const v = Validation.create()
        v.error( 'GTFS-003', 'trips.txt', 'broken FK' )
        const report = v.report()
        expect( report.status ).toBe( false )
        expect( report.errors.length ).toBe( 1 )
        expect( report.errors[ 0 ].code ).toBe( 'GTFS-003' )
        expect( report.errors[ 0 ].file ).toBe( 'trips.txt' )
    } )


    test( 'warning adds warning entry', () => {
        const v = Validation.create()
        v.warning( 'GTFS-101', 'fare_attributes.txt', 'legacy v1' )
        const report = v.report()
        expect( report.status ).toBe( true )
        expect( report.warnings.length ).toBe( 1 )
    } )


    test( 'info adds info entry', () => {
        const v = Validation.create()
        v.info( 'GTFS-201', 'locations.geojson', 'flex detected' )
        const report = v.report()
        expect( report.status ).toBe( true )
        expect( report.info.length ).toBe( 1 )
    } )


    test( 'error throws if code is not ERROR severity', () => {
        const v = Validation.create()
        expect( () => v.error( 'GTFS-101', 'x', 'y' ) ).toThrow( 'is not an ERROR' )
    } )


    test( 'warning throws if code is not WARNING severity', () => {
        const v = Validation.create()
        expect( () => v.warning( 'GTFS-001', 'x', 'y' ) ).toThrow( 'is not a WARNING' )
    } )


    test( 'info throws if code is not INFO severity', () => {
        const v = Validation.create()
        expect( () => v.info( 'GTFS-001', 'x', 'y' ) ).toThrow( 'is not an INFO' )
    } )


    test( 'report summary counts are correct', () => {
        const v = Validation.create()
        v.error( 'GTFS-001', 'agency.txt', 'missing' )
        v.error( 'GTFS-002', 'routes.txt', 'missing field' )
        v.warning( 'GTFS-101', 'fare_attributes.txt', 'legacy' )
        v.info( 'GTFS-201', 'locations.geojson', 'flex' )
        const report = v.report()
        expect( report.summary.errorCount ).toBe( 2 )
        expect( report.summary.warningCount ).toBe( 1 )
        expect( report.summary.infoCount ).toBe( 1 )
        expect( report.status ).toBe( false )
    } )


    test( 'addValidator adds custom validator', () => {
        const v = Validation.create()
        let called = false
        v.addValidator( () => { called = true } )
        v.runAdditionalValidators( { parsedFiles: new Map() } )
        expect( called ).toBe( true )
    } )


    test( 'addValidator throws if not a function', () => {
        const v = Validation.create()
        expect( () => v.addValidator( 'not a function' ) ).toThrow( 'must be a function' )
    } )
} )
