import yauzl from 'yauzl'


export class ZipExtractor {
    static extractZipToBuffer( { zipPath } ) {
        return new Promise( ( resolve, reject ) => {
            yauzl.open( zipPath, { lazyEntries: true }, ( err, zipfile ) => {
                if( err ) {
                    reject( err )
                    return
                }
                ZipExtractor.#readEntries( { zipfile, resolve, reject } )
            } )
        } )
    }


    static extractZipBufferToFiles( { buffer } ) {
        return new Promise( ( resolve, reject ) => {
            yauzl.fromBuffer( buffer, { lazyEntries: true }, ( err, zipfile ) => {
                if( err ) {
                    reject( err )
                    return
                }
                ZipExtractor.#readEntries( { zipfile, resolve, reject } )
            } )
        } )
    }


    static detectEncoding( { buffer } ) {
        const len = Math.min( buffer.length, 4096 )
        let isUtf8 = true
        let i = 0
        while( i < len ) {
            const byte = buffer[ i ]
            if( byte === 0xEF && i + 2 < len && buffer[ i + 1 ] === 0xBB && buffer[ i + 2 ] === 0xBF ) {
                return { encoding: 'utf-8', hasBom: true }
            }
            if( byte > 0x7F ) {
                if( byte >= 0xC2 && byte <= 0xDF && i + 1 < len && buffer[ i + 1 ] >= 0x80 && buffer[ i + 1 ] <= 0xBF ) {
                    i += 2
                    continue
                }
                if( byte >= 0xE0 && byte <= 0xEF && i + 2 < len ) {
                    i += 3
                    continue
                }
                isUtf8 = false
                break
            }
            i += 1
        }
        if( isUtf8 ) {
            return { encoding: 'utf-8', hasBom: false }
        }
        return { encoding: 'non-utf-8', hasBom: false }
    }


    static #readEntries( { zipfile, resolve, reject } ) {
        const files = new Map()
        zipfile.readEntry()
        zipfile.on( 'entry', ( entry ) => {
            if( /\/$/.test( entry.fileName ) ) {
                zipfile.readEntry()
                return
            }
            zipfile.openReadStream( entry, ( err, readStream ) => {
                if( err ) {
                    reject( err )
                    return
                }
                const chunks = []
                readStream.on( 'data', ( chunk ) => {
                    chunks.push( chunk )
                } )
                readStream.on( 'end', () => {
                    const filename = entry.fileName.split( '/' ).pop()
                    files.set( filename, Buffer.concat( chunks ) )
                    zipfile.readEntry()
                } )
                readStream.on( 'error', reject )
            } )
        } )
        zipfile.on( 'end', () => {
            resolve( { files } )
        } )
        zipfile.on( 'error', reject )
    }
}
