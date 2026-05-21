import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


const __dirname = dirname( fileURLToPath( import.meta.url ) )

const SPEC_MD_PATH = process.argv[ 2 ] || join( __dirname, '..', '..', '..', 'context', 'gtfs-schedule-spec-2026-04-27', 'reference.md' )
const OUTPUT_PATH  = join( __dirname, '..', 'src', 'converters', 'schedule', 'spec', 'spec-reference-2026-04-27.json' )
const SPEC_REVISION = '2026-04-27'
const SPEC_URL = 'https://gtfs.org/documentation/schedule/reference/'


const FILE_HEADING_RX = /^### ([a-z_]+\.(?:txt|geojson))\s*$/m
const FILE_STATUS_RX  = /^File:\s*\*\*([^*]+)\*\*/m
const PRIMARY_KEY_RX  = /Primary key \(([^)]+)\)/
const FIELD_ROW_RX    = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|$/gm
const FK_TEXT_RX      = /[Ff]oreign ID referencing\s+`?([a-z_]+\.txt)`?\.`?([a-z_]+)`?|[Ff]oreign ID referencing\s+\[?`?([a-z_]+\.txt)`?\]?[^.]*\.\s*`?([a-z_]+)`?/


const normalizePresence = ( raw ) => {
    const cleaned = raw.replace( /\*+/g, '' ).trim().toLowerCase()
    if( cleaned === 'required' ) return 'required'
    if( cleaned === 'optional' ) return 'optional'
    if( cleaned.startsWith( 'conditionally required' ) ) return 'conditionally_required'
    if( cleaned.startsWith( 'conditionally forbidden' ) ) return 'conditionally_forbidden'
    if( cleaned.startsWith( 'conditionally' ) ) return 'conditional'
    if( cleaned === 'recommended' ) return 'recommended'
    return cleaned
}


const normalizeFileStatus = ( raw ) => {
    const cleaned = raw.toLowerCase().trim()
    if( cleaned === 'required' ) return 'required'
    if( cleaned === 'optional' ) return 'optional'
    if( cleaned === 'conditionally required' ) return 'conditionally_required'
    if( cleaned === 'conditionally forbidden' ) return 'conditionally_forbidden'
    if( cleaned === 'recommended' ) return 'recommended'
    return cleaned
}


const mapType = ( raw ) => {
    const cleaned = raw.replace( /\*+/g, '' ).trim()
    const lower = cleaned.toLowerCase()
    if( lower === 'unique id' || lower === 'foreign id' || lower === 'id' ) return 'TEXT'
    if( lower === 'text' || lower === 'language code' || lower === 'phone number' || lower === 'email' || lower === 'url' || lower === 'timezone' || lower === 'color' || lower === 'currency code' || lower === 'currency amount' || lower === 'time' || lower === 'date' ) return 'TEXT'
    if( lower === 'enum' ) return 'INTEGER'
    if( lower === 'integer' || lower === 'non-negative integer' || lower === 'positive integer' || lower === 'non-null integer' ) return 'INTEGER'
    if( lower === 'float' || lower === 'non-negative float' || lower === 'positive float' || lower === 'latitude' || lower === 'longitude' ) return 'REAL'
    return 'TEXT'
}


const extractForeignKey = ( description ) => {
    const m = description.match( /[Ff]oreign ID referencing\s+`?([a-z_]+)`?\.`?([a-z_]+)`?/ )
    if( m ) {
        const tableName = m[ 1 ]
        const fileName = tableName.endsWith( '.txt' ) || tableName.endsWith( '.geojson' )
            ? tableName
            : `${tableName}.txt`
        return { file: fileName, field: m[ 2 ] }
    }
    return null
}


const parseFileSection = ( filename, sectionText ) => {
    const statusMatch = sectionText.match( FILE_STATUS_RX )
    const fileStatus = statusMatch ? normalizeFileStatus( statusMatch[ 1 ] ) : 'unknown'

    const pkMatch = sectionText.match( PRIMARY_KEY_RX )
    const primaryKey = pkMatch
        ? pkMatch[ 1 ].split( ',' ).map( ( s ) => s.trim().replace( /`/g, '' ) )
        : []

    const fields = []
    const foreignKeys = []
    let m
    FIELD_ROW_RX.lastIndex = 0
    while( ( m = FIELD_ROW_RX.exec( sectionText ) ) !== null ) {
        const name = m[ 1 ]
        if( name === 'Field Name' ) continue
        const rawType = m[ 2 ]
        const rawPresence = m[ 3 ]
        const description = m[ 4 ]
        const fk = extractForeignKey( rawType ) || extractForeignKey( description )
        const field = {
            name,
            type: mapType( rawType ),
            rawType: rawType.replace( /\*+/g, '' ).trim(),
            presence: normalizePresence( rawPresence )
        }
        if( fk ) {
            field.foreignKey = fk
            foreignKeys.push( { from: name, to: fk } )
        }
        fields.push( field )
    }

    return { filename, fileStatus, primaryKey, fields, foreignKeys }
}


const parseSpec = ( markdown ) => {
    const lines = markdown.split( '\n' )
    const sections = {}
    let currentFile = null
    let currentBuffer = []
    lines.forEach( ( line ) => {
        const m = line.match( /^### ([a-z_]+\.(?:txt|geojson))\s*$/ )
        if( m ) {
            if( currentFile ) {
                sections[ currentFile ] = currentBuffer.join( '\n' )
            }
            currentFile = m[ 1 ]
            currentBuffer = []
            return
        }
        if( currentFile ) {
            currentBuffer.push( line )
        }
    } )
    if( currentFile ) {
        sections[ currentFile ] = currentBuffer.join( '\n' )
    }

    const files = {}
    Object.entries( sections ).forEach( ( [ filename, sectionText ] ) => {
        files[ filename ] = parseFileSection( filename, sectionText )
    } )
    return files
}


const main = () => {
    console.log( `Reading spec from: ${SPEC_MD_PATH}` )
    const md = readFileSync( SPEC_MD_PATH, 'utf-8' )
    const files = parseSpec( md )
    const fileCount = Object.keys( files ).length
    console.log( `Parsed ${fileCount} files` )
    if( fileCount !== 32 ) {
        console.warn( `WARNING: expected 32 files, got ${fileCount}` )
    }

    const output = {
        specUrl: SPEC_URL,
        specRevision: SPEC_REVISION,
        sourceMarkdown: 'https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md',
        generatedAt: new Date().toISOString(),
        files
    }

    writeFileSync( OUTPUT_PATH, JSON.stringify( output, null, 2 ) )
    console.log( `Wrote: ${OUTPUT_PATH}` )

    const requiredFiles = Object.entries( files )
        .filter( ( [ , f ] ) => f.fileStatus === 'required' )
        .map( ( [ name ] ) => name )
    console.log( `Required files (${requiredFiles.length}):`, requiredFiles.join( ', ' ) )

    const totalFields = Object.values( files ).reduce( ( s, f ) => s + f.fields.length, 0 )
    const totalFks = Object.values( files ).reduce( ( s, f ) => s + f.foreignKeys.length, 0 )
    console.log( `Total fields: ${totalFields}, Total FKs detected: ${totalFks}` )
}


main()
