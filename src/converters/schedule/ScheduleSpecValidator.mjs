import specReference from './spec/spec-reference.mjs'
import { Validation } from '../../shared/Validation.mjs'


export class ScheduleSpecValidator {
    static getSpec() {
        return specReference
    }


    static validate( { parsedFiles, validation } ) {
        const v = validation || Validation.create()
        const spec = specReference.files
        const fileNames = new Set( parsedFiles.keys() )

        ScheduleSpecValidator.#checkRequiredFiles( { spec, fileNames, validation: v } )
        parsedFiles.forEach( ( parsed, filename ) => {
            const fileSpec = spec[ filename ]
            if( !fileSpec ) {
                return
            }
            ScheduleSpecValidator.#checkRequiredFields( { fileSpec, parsed, filename, validation: v } )
        } )

        return v
    }


    static #checkRequiredFiles( { spec, fileNames, validation } ) {
        Object.entries( spec ).forEach( ( [ filename, fileSpec ] ) => {
            if( fileSpec.fileStatus !== 'required' ) {
                return
            }
            if( !fileNames.has( filename ) ) {
                validation.error( 'GTFS-001', filename, `Required file missing: ${filename}` )
            }
        } )
    }


    static #checkRequiredFields( { fileSpec, parsed, filename, validation } ) {
        const headers = new Set( parsed.headers || [] )
        fileSpec.fields.forEach( ( field ) => {
            if( field.presence !== 'required' ) {
                return
            }
            if( !headers.has( field.name ) ) {
                validation.error( 'GTFS-002', filename, `Required field missing: ${field.name}` )
            }
        } )
    }
}
