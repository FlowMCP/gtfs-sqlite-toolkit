export class CsvParser {
    static parse( { buffer, filename } ) {
        const messages = []
        const text = CsvParser.#decodeBuffer( { buffer, filename, messages } )
        if( text === null ) {
            return { headers: [], rows: [], status: false, messages }
        }
        const cleanText = CsvParser.#stripBom( { text } )
        const lines = CsvParser.#splitLines( { text: cleanText } )
        if( lines.length === 0 ) {
            messages.push( { code: 'GTFS-006', file: filename, message: 'File is empty' } )
            return { headers: [], rows: [], status: false, messages }
        }
        const headerLine = lines.shift()
        const headers = CsvParser.#parseRow( { line: headerLine } )
        if( headers.length === 0 ) {
            messages.push( { code: 'GTFS-005', file: filename, message: 'No header row' } )
            return { headers: [], rows: [], status: false, messages }
        }
        const rows = lines
            .filter( ( line ) => line.length > 0 )
            .map( ( line ) => CsvParser.#parseRow( { line } ) )
            .map( ( values ) => CsvParser.#rowToObject( { headers, values } ) )
        return { headers, rows, status: true, messages }
    }


    static #decodeBuffer( { buffer, filename, messages } ) {
        try {
            return buffer.toString( 'utf-8' )
        } catch ( err ) {
            messages.push( { code: 'GTFS-006', file: filename, message: `Cannot decode: ${err.message}` } )
            return null
        }
    }


    static #stripBom( { text } ) {
        if( text.length > 0 && text.charCodeAt( 0 ) === 0xFEFF ) {
            return text.substring( 1 )
        }
        return text
    }


    static #splitLines( { text } ) {
        const normalized = text.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' )
        const lines = normalized.split( '\n' )
        if( lines.length > 0 && lines[ lines.length - 1 ] === '' ) {
            lines.pop()
        }
        return lines
    }


    static #parseRow( { line } ) {
        const result = []
        let current = ''
        let inQuotes = false
        let i = 0
        while( i < line.length ) {
            const ch = line[ i ]
            if( inQuotes ) {
                if( ch === '"' ) {
                    if( i + 1 < line.length && line[ i + 1 ] === '"' ) {
                        current += '"'
                        i += 2
                        continue
                    }
                    inQuotes = false
                    i += 1
                    continue
                }
                current += ch
                i += 1
                continue
            }
            if( ch === '"' ) {
                inQuotes = true
                i += 1
                continue
            }
            if( ch === ',' ) {
                result.push( current )
                current = ''
                i += 1
                continue
            }
            current += ch
            i += 1
        }
        result.push( current )
        return result.map( ( v ) => v.trim() )
    }


    static #rowToObject( { headers, values } ) {
        const obj = {}
        headers.forEach( ( header, idx ) => {
            obj[ header ] = idx < values.length ? values[ idx ] : ''
        } )
        return obj
    }
}
