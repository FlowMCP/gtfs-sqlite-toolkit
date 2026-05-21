import specReference from './spec/spec-reference.mjs'
import { Validation } from '../../shared/Validation.mjs'


export class ScheduleForeignKeyChecker {
    static check( { parsedFiles, validation } ) {
        const v = validation || Validation.create()
        const spec = specReference.files

        const keysByTable = ScheduleForeignKeyChecker.#buildKeyIndex( { spec, parsedFiles } )

        parsedFiles.forEach( ( parsed, filename ) => {
            const fileSpec = spec[ filename ]
            if( !fileSpec ) {
                return
            }
            const fks = fileSpec.fields.filter( ( f ) => f.foreignKey )
            if( fks.length === 0 ) {
                return
            }
            ScheduleForeignKeyChecker.#checkFile( { parsed, filename, fks, keysByTable, validation: v } )
        } )

        return v
    }


    static #buildKeyIndex( { spec, parsedFiles } ) {
        const index = new Map()
        parsedFiles.forEach( ( parsed, filename ) => {
            const fileSpec = spec[ filename ]
            if( !fileSpec ) {
                return
            }
            const fieldSet = {}
            ;( parsed.headers || [] ).forEach( ( fieldName ) => {
                const values = new Set()
                parsed.rows.forEach( ( row ) => {
                    const v = row[ fieldName ]
                    if( v !== undefined && v !== null && v !== '' ) {
                        values.add( v )
                    }
                } )
                fieldSet[ fieldName ] = values
            } )
            index.set( filename, fieldSet )
        } )
        return index
    }


    static #checkFile( { parsed, filename, fks, keysByTable, validation } ) {
        parsed.rows.forEach( ( row, rowIdx ) => {
            fks.forEach( ( field ) => {
                const value = row[ field.name ]
                if( value === undefined || value === null || value === '' ) {
                    return
                }
                const targetFile = field.foreignKey.file
                const targetField = field.foreignKey.field
                const targetIndex = keysByTable.get( targetFile )
                if( !targetIndex ) {
                    return
                }
                const targetSet = targetIndex[ targetField ]
                if( !targetSet ) {
                    return
                }
                if( !targetSet.has( value ) ) {
                    validation.error( 'GTFS-003', filename, `${field.name} "${value}" (row ${rowIdx + 2}) not in ${targetFile}.${targetField}` )
                }
            } )
        } )
    }
}
