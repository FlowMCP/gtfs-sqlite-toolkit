const GTFS_CODES = {
    'GTFS-001': { severity: 'ERROR',   description: 'Required file missing' },
    'GTFS-002': { severity: 'ERROR',   description: 'Required field missing in file' },
    'GTFS-003': { severity: 'ERROR',   description: 'Foreign key broken (value not found in referenced table)' },
    'GTFS-004': { severity: 'ERROR',   description: 'Datatype mismatch' },
    'GTFS-005': { severity: 'ERROR',   description: 'CSV file has no header row' },
    'GTFS-006': { severity: 'ERROR',   description: 'File is empty or unparseable' },
    'GTFS-007': { severity: 'ERROR',   description: 'Unsupported spec or version' },
    'GTFS-008': { severity: 'ERROR',   description: 'No GTFS files found in input' },

    'GTFS-101': { severity: 'WARNING', description: 'Legacy V1 fare file detected (ignored)' },
    'GTFS-102': { severity: 'WARNING', description: 'Optional field has unexpected value' },
    'GTFS-103': { severity: 'WARNING', description: 'Duplicate primary key' },
    'GTFS-104': { severity: 'WARNING', description: 'Non-UTF-8 encoding detected' },
    'GTFS-105': { severity: 'WARNING', description: 'Empty optional file' },
    'GTFS-106': { severity: 'WARNING', description: 'Deprecated field used' },
    'GTFS-107': { severity: 'WARNING', description: 'Inconsistent timezone usage' },

    'GTFS-201': { severity: 'INFO',    description: 'GTFS-Flex detected' },
    'GTFS-202': { severity: 'INFO',    description: 'Shapes available' },
    'GTFS-203': { severity: 'INFO',    description: 'Multilingual translations present' },
    'GTFS-204': { severity: 'INFO',    description: 'Pathways available' },
    'GTFS-205': { severity: 'INFO',    description: 'Fare V2 system detected' },
    'GTFS-206': { severity: 'INFO',    description: 'Attributions present' }
}


export class Validation {
    #errors
    #warnings
    #info
    #additionalValidators


    constructor() {
        this.#errors = []
        this.#warnings = []
        this.#info = []
        this.#additionalValidators = []
    }


    static create() {
        return new Validation()
    }


    static getCodes() {
        return { ...GTFS_CODES }
    }


    static getCodeMeta( { code } ) {
        if( !GTFS_CODES[ code ] ) {
            throw new Error( `Unknown GTFS code: ${code}` )
        }
        return { ...GTFS_CODES[ code ] }
    }


    error( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'ERROR' ) {
            throw new Error( `Code ${code} is not an ERROR (severity: ${meta.severity})` )
        }
        this.#errors.push( { code, file, message, severity: 'ERROR' } )
    }


    warning( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'WARNING' ) {
            throw new Error( `Code ${code} is not a WARNING (severity: ${meta.severity})` )
        }
        this.#warnings.push( { code, file, message, severity: 'WARNING' } )
    }


    info( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'INFO' ) {
            throw new Error( `Code ${code} is not an INFO (severity: ${meta.severity})` )
        }
        this.#info.push( { code, file, message, severity: 'INFO' } )
    }


    addValidator( validator ) {
        if( typeof validator !== 'function' ) {
            throw new Error( 'additionalValidator must be a function' )
        }
        this.#additionalValidators.push( validator )
    }


    runAdditionalValidators( { parsedFiles } ) {
        this.#additionalValidators.forEach( ( validator ) => {
            validator( { parsedFiles, validation: this } )
        } )
    }


    report() {
        return {
            status: this.#errors.length === 0,
            errors: [ ...this.#errors ],
            warnings: [ ...this.#warnings ],
            info: [ ...this.#info ],
            summary: {
                errorCount: this.#errors.length,
                warningCount: this.#warnings.length,
                infoCount: this.#info.length
            }
        }
    }
}
