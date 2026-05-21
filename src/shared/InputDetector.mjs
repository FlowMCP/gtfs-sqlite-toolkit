import { statSync, existsSync } from 'node:fs'


const ZIP_MAGIC = Buffer.from( [ 0x50, 0x4B, 0x03, 0x04 ] )
const GZIP_MAGIC = Buffer.from( [ 0x1F, 0x8B ] )


export class InputDetector {
    static detect( { input } ) {
        if( Buffer.isBuffer( input ) ) {
            if( input.length >= 4 && input.subarray( 0, 4 ).equals( ZIP_MAGIC ) ) {
                return { inputType: 'buffer' }
            }
            if( input.length >= 2 && input.subarray( 0, 2 ).equals( GZIP_MAGIC ) ) {
                return { inputType: 'targz-buffer' }
            }
            throw new Error( 'Unknown buffer magic bytes' )
        }
        if( typeof input === 'string' ) {
            const lower = input.toLowerCase()
            if( lower.endsWith( '.zip' ) ) {
                return { inputType: 'zip' }
            }
            if( lower.endsWith( '.tar.gz' ) || lower.endsWith( '.tgz' ) ) {
                return { inputType: 'targz' }
            }
            if( lower.endsWith( '.pb' ) ) {
                throw new Error( 'GTFS-Realtime (.pb) is not supported by this toolkit' )
            }
            if( existsSync( input ) && statSync( input ).isDirectory() ) {
                return { inputType: 'folder' }
            }
            throw new Error( `Cannot detect input type from path: ${input}` )
        }
        throw new Error( 'Input must be Buffer or string path' )
    }
}
